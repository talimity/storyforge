import {
  type CharacterMapping,
  type ChatImportAnalyzeOutput,
  type SillyTavernMessage,
  sillyTavernMessageSchema,
} from "@storyforge/contracts";
import { type SqliteDatabase, schema } from "@storyforge/db";
import { assertDefined } from "@storyforge/utils";
import { eq } from "drizzle-orm";
import { logger } from "../../logging.js";
import { ServiceError } from "../../service-error.js";
import type { ScenarioService } from "../scenario/scenario.service.js";
import type { TimelineService } from "../timeline/timeline.service.js";

const { characters: tCharacters, scenarioParticipants: tParticipants, turns: tTurns } = schema;

interface ImportArgs {
  fileDataUri: string;
  scenarioName: string;
  scenarioDescription?: string;
  mappings: CharacterMapping[];
}

export class ChatImportService {
  constructor(
    private db: SqliteDatabase,
    private scenarioService: ScenarioService,
    private timelineService: TimelineService
  ) {}

  async analyzeChat(fileDataUri: string): Promise<ChatImportAnalyzeOutput> {
    try {
      const messages = this.parseJSONL(fileDataUri);
      const characterStats = new Map<
        string,
        { count: number; isUser: boolean; isSystem: boolean }
      >();

      let validMessages = 0;
      let skippedMessages = 0;

      for (const message of messages) {
        if (this.shouldSkipMessage(message)) {
          skippedMessages++;
          continue;
        }

        validMessages++;
        const stats = characterStats.get(message.name) || {
          count: 0,
          isUser: false,
          isSystem: false,
        };
        stats.count++;
        stats.isUser = stats.isUser || !!message.is_user;
        stats.isSystem =
          stats.isSystem || (message.name === "System" && !message.extra?.isSmallSys);
        characterStats.set(message.name, stats);
      }

      const detectedCharacters = await this.detectCharacters(characterStats);

      return {
        success: true,
        detectedCharacters,
        totalMessages: messages.length,
        validMessages,
        skippedMessages,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        detectedCharacters: [],
        totalMessages: 0,
        validMessages: 0,
        skippedMessages: 0,
        error: `Failed to analyze chat: ${message}`,
      };
    }
  }

  async importChatAsScenario(args: ImportArgs) {
    return this.db.transaction(async (tx) => {
      const atLeastTwoMapped = args.mappings.filter((m) => m.targetType !== "ignore").length;
      if (atLeastTwoMapped < 2) {
        throw new ServiceError("InvalidInput", {
          message: "You must map at least two participants.",
        });
      }

      const characterIds: string[] = [];
      for (const mapping of args.mappings) {
        if (mapping.targetType === "character") {
          characterIds.push(mapping.characterId);
        }
      }

      const scenario = await this.scenarioService.createScenario(
        {
          name: args.scenarioName,
          description:
            args.scenarioDescription ||
            `Imported from SillyTavern on ${new Date().toLocaleDateString()}`,
          characterIds,
        },
        tx
      );

      // Build participant map from created scenario participants
      const participantMap = new Map<string, string>();

      const participants = await tx
        .select()
        .from(tParticipants)
        .where(eq(tParticipants.scenarioId, scenario.id));

      for (const mapping of args.mappings) {
        if (mapping.targetType === "ignore") continue;

        if (mapping.targetType === "character") {
          const participant = participants.find((p) => p.characterId === mapping.characterId);
          if (participant) {
            participantMap.set(mapping.detectedName, participant.id);
          }
        }
      }

      // Set narrator mapping if it exists
      for (const mapping of args.mappings) {
        if (mapping.targetType === "narrator") {
          const n = participants.find((p) => p.type === "narrator");
          assertDefined(n); // createScenario creates it
          participantMap.set(mapping.detectedName, n?.id);
        }
      }

      const messages = this.parseJSONL(args.fileDataUri);
      let turnCount = 0;

      for (const message of messages) {
        if (this.shouldSkipMessage(message)) continue;

        const participantId = participantMap.get(message.name);
        if (!participantId) continue;

        // Messages which have is_system set to `true` seem to be 'ghost'/inactive
        // Note that this is distinct from is_system being set to `""` which
        // seems to indicate a diagetic narrator/system message (idk man shit's weird)
        const isGhost = message.is_system === true;

        const layers = [
          {
            key: "presentation",
            content: this.cleanMessageContent(message.mes),
          },
        ];

        if (message.extra?.reasoning) {
          // TODO: Change this if reasoning becomes a column on each layer,
          // since technically any model output that generates a content layer
          // can have also produced reasoning.
          layers.push({
            key: "reasoning",
            content: message.extra.reasoning,
          });
        }

        const newTurn = await this.timelineService.advanceTurn(
          {
            scenarioId: scenario.id,
            authorParticipantId: participantId,
            layers,
          },
          tx
        );

        if (isGhost) {
          await tx.update(tTurns).set({ isGhost: true }).where(eq(tTurns.id, newTurn.id));
        }

        turnCount++;
      }

      return { scenarioId: scenario.id, turnCount };
    });
  }

  private parseJSONL(fileDataUri: string): SillyTavernMessage[] {
    const base64Data = fileDataUri.split(",")[1];
    if (!base64Data) {
      throw new ServiceError("InvalidInput", {
        message: "File data URI is invalid or missing base64 data.",
      });
    }

    const jsonlContent = Buffer.from(base64Data, "base64").toString("utf-8");
    const lines = jsonlContent.split("\n").filter((line) => line.trim());

    const messages: SillyTavernMessage[] = [];
    let errs = 0;
    for (const [_index, line] of lines.entries()) {
      try {
        const parsed = JSON.parse(line);
        const validated = sillyTavernMessageSchema.parse(parsed);
        messages.push(validated);
      } catch (error) {
        logger.warn({ error, line }, `Failed to parse line: ${line}`);
        errs++;
      }
    }

    if (errs > 0) {
      logger.warn({ count: errs }, `Some lines could not be parsed!`);
    }

    return messages;
  }

  private shouldSkipMessage(message: SillyTavernMessage): boolean {
    if (message.name === "SillyTavern System" && message.extra?.isSmallSys === true) {
      // These messages are ST UI messages, not diagetic content. 'small' means
      // they are not included in the prompt so we do not want them either.
      return true;
    }

    return !message.mes || message.mes.trim().length === 0;
  }

  private cleanMessageContent(content: string): string {
    return content.trim();
  }

  private async detectCharacters(
    characterStats: Map<string, { count: number; isUser: boolean; isSystem: boolean }>
  ) {
    const allCharacters = await this.db.select().from(tCharacters).all();

    const detectedCharacters = Array.from(characterStats.entries()).map(([name, stats]) => {
      const matchedCharacter = allCharacters.find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );

      return {
        name,
        messageCount: stats.count,
        suggestedCharacterId: matchedCharacter?.id || null,
        isUser: stats.isUser,
        isSystem: stats.isSystem,
      };
    });

    return detectedCharacters.sort((a, b) => b.messageCount - a.messageCount);
  }
}
