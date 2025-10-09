import { createHash } from "node:crypto";
import type {
  AssignScenarioManualLorebookInput,
  LinkCharacterLorebookInput,
  ScenarioLorebookAssignmentInput,
  UpdateScenarioCharacterLorebookOverrideInput,
  UpdateScenarioManualLorebookStateInput,
} from "@storyforge/contracts";
import {
  type Lorebook,
  type NewLorebook,
  type SqliteDatabase,
  type SqliteTransaction,
  schema,
} from "@storyforge/db";
import {
  computeLorebookFingerprint,
  type LorebookData,
  normalizeLorebookData,
  parseLorebookData,
} from "@storyforge/lorebooks";
import { and, eq, inArray } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { CharacterBookSchema } from "../character/utils/parse-tavern-card.js";
import { normalizeSillyTavernLorebook } from "./utils/sillytavern-lorebook-parser.js";

type CreateLorebookArgs = {
  data: LorebookData;
  source?: NewLorebook["source"];
};

type UpdateLorebookArgs = {
  id: string;
  data: LorebookData;
};

type ManualScenarioLorebookAssignment = {
  lorebookId: string;
  enabled: boolean;
};

type ScenarioCharacterOverride = {
  characterLorebookId: string;
  enabled: boolean;
};

type ImportLorebookResult = {
  lorebook: Lorebook;
  created: boolean;
};

export class LorebookService {
  constructor(private readonly db: SqliteDatabase) {}

  private hashLorebook(data: LorebookData): string {
    return computeLorebookFingerprint(data, (input) =>
      createHash("sha256").update(input, "utf8").digest("hex")
    );
  }

  async createLorebook(args: CreateLorebookArgs, outerTx?: SqliteTransaction) {
    const normalized = normalizeLorebookData(args.data);
    const fingerprint = this.hashLorebook(normalized);
    const entryCount = normalized.entries.length;
    const name = normalized.name?.trim() || "Untitled Lorebook";
    const description = normalized.description?.trim() || null;
    const source = args.source ?? "manual";

    const work = async (tx: SqliteTransaction) => {
      const existing = await tx
        .select()
        .from(schema.lorebooks)
        .where(eq(schema.lorebooks.fingerprint, fingerprint))
        .limit(1);

      if (existing[0]) {
        return { lorebook: existing[0], created: false } satisfies ImportLorebookResult;
      }

      const [inserted] = await tx
        .insert(schema.lorebooks)
        .values({
          name,
          description,
          data: normalized,
          fingerprint,
          entryCount,
          source,
        })
        .returning();

      if (!inserted) {
        throw new ServiceError("InvalidInput", {
          message: "Failed to create lorebook.",
        });
      }

      return { lorebook: inserted, created: true } satisfies ImportLorebookResult;
    };

    return outerTx ? work(outerTx) : this.db.transaction(work);
  }

  async updateLorebook(args: UpdateLorebookArgs, outerTx?: SqliteTransaction) {
    const normalized = normalizeLorebookData(args.data);
    const fingerprint = this.hashLorebook(normalized);
    const entryCount = normalized.entries.length;
    const name = normalized.name?.trim() || "Untitled Lorebook";
    const description = normalized.description?.trim() || null;

    const work = async (tx: SqliteTransaction) => {
      const [existing] = await tx
        .select()
        .from(schema.lorebooks)
        .where(eq(schema.lorebooks.id, args.id))
        .limit(1);

      if (!existing) {
        throw new ServiceError("NotFound", {
          message: `Lorebook ${args.id} not found.`,
        });
      }

      const [conflict] = await tx
        .select({ id: schema.lorebooks.id })
        .from(schema.lorebooks)
        .where(eq(schema.lorebooks.fingerprint, fingerprint))
        .limit(1);

      if (conflict && conflict.id !== args.id) {
        throw new ServiceError("Conflict", {
          message: "Another lorebook with identical content already exists.",
        });
      }

      const [updated] = await tx
        .update(schema.lorebooks)
        .set({
          name,
          description,
          data: normalized,
          fingerprint,
          entryCount,
        })
        .where(eq(schema.lorebooks.id, args.id))
        .returning();

      if (!updated) {
        throw new ServiceError("InvalidInput", {
          message: "Failed to update lorebook.",
        });
      }

      return updated;
    };

    return outerTx ? work(outerTx) : this.db.transaction(work);
  }

  async deleteLorebook(id: string) {
    const result = await this.db
      .delete(schema.lorebooks)
      .where(eq(schema.lorebooks.id, id))
      .returning();

    return result.length > 0;
  }

  async importLorebookFromDataUri(
    fileDataUri: string,
    source: NewLorebook["source"] = "silly_v2",
    options?: { filename?: string }
  ) {
    const buffer = decodeDataUri(fileDataUri);
    const parsedJson = parseJson(buffer.toString("utf8"));
    const maybeConverted = normalizeSillyTavernLorebook(parsedJson, {
      filename: options?.filename,
    });
    const data = maybeConverted
      ? normalizeLorebookData(maybeConverted)
      : normalizeLorebookData(coerceLorebookData(parsedJson));

    return this.createLorebook({ data, source });
  }

  async addManualLorebookToScenario(
    args: AssignScenarioManualLorebookInput,
    outerTx?: SqliteTransaction
  ) {
    const work = async (tx: SqliteTransaction) => {
      const [existing] = await tx
        .select({ id: schema.scenarioLorebooks.id, enabled: schema.scenarioLorebooks.enabled })
        .from(schema.scenarioLorebooks)
        .where(
          and(
            eq(schema.scenarioLorebooks.scenarioId, args.scenarioId),
            eq(schema.scenarioLorebooks.lorebookId, args.lorebookId)
          )
        )
        .limit(1);

      const enabled = args.enabled ?? existing?.enabled ?? true;

      if (existing) {
        if (existing.enabled === enabled) {
          return existing;
        }

        const [updated] = await tx
          .update(schema.scenarioLorebooks)
          .set({ enabled })
          .where(eq(schema.scenarioLorebooks.id, existing.id))
          .returning();

        return updated;
      }

      const [inserted] = await tx
        .insert(schema.scenarioLorebooks)
        .values({
          scenarioId: args.scenarioId,
          lorebookId: args.lorebookId,
          enabled,
        })
        .returning();

      return inserted;
    };

    return outerTx ? work(outerTx) : this.db.transaction(work);
  }

  async removeManualLorebookFromScenario(args: AssignScenarioManualLorebookInput) {
    await this.db
      .delete(schema.scenarioLorebooks)
      .where(
        and(
          eq(schema.scenarioLorebooks.scenarioId, args.scenarioId),
          eq(schema.scenarioLorebooks.lorebookId, args.lorebookId)
        )
      );
  }

  async setManualLorebookState(
    args: UpdateScenarioManualLorebookStateInput,
    outerTx?: SqliteTransaction
  ) {
    const work = async (tx: SqliteTransaction) => {
      const [existing] = await tx
        .select({ id: schema.scenarioLorebooks.id })
        .from(schema.scenarioLorebooks)
        .where(
          and(
            eq(schema.scenarioLorebooks.scenarioId, args.scenarioId),
            eq(schema.scenarioLorebooks.lorebookId, args.lorebookId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new ServiceError("NotFound", {
          message: "Lorebook assignment not found for scenario.",
        });
      }

      const [updated] = await tx
        .update(schema.scenarioLorebooks)
        .set({ enabled: args.enabled })
        .where(eq(schema.scenarioLorebooks.id, existing.id))
        .returning();

      return updated;
    };

    return outerTx ? work(outerTx) : this.db.transaction(work);
  }

  async setCharacterLorebookOverride(
    args: UpdateScenarioCharacterLorebookOverrideInput,
    outerTx?: SqliteTransaction
  ) {
    const work = async (tx: SqliteTransaction) => {
      const [existing] = await tx
        .select({ id: schema.scenarioCharacterLorebookOverrides.id })
        .from(schema.scenarioCharacterLorebookOverrides)
        .where(
          and(
            eq(schema.scenarioCharacterLorebookOverrides.scenarioId, args.scenarioId),
            eq(
              schema.scenarioCharacterLorebookOverrides.characterLorebookId,
              args.characterLorebookId
            )
          )
        )
        .limit(1);

      if (existing) {
        const [updated] = await tx
          .update(schema.scenarioCharacterLorebookOverrides)
          .set({ enabled: args.enabled })
          .where(eq(schema.scenarioCharacterLorebookOverrides.id, existing.id))
          .returning();

        return updated;
      }

      const [inserted] = await tx
        .insert(schema.scenarioCharacterLorebookOverrides)
        .values({
          scenarioId: args.scenarioId,
          characterLorebookId: args.characterLorebookId,
          enabled: args.enabled,
        })
        .returning();

      return inserted;
    };

    return outerTx ? work(outerTx) : this.db.transaction(work);
  }

  async replaceScenarioLorebookSettings(
    scenarioId: string,
    assignments: readonly ScenarioLorebookAssignmentInput[],
    outerTx?: SqliteTransaction
  ) {
    const manualAssignments: ManualScenarioLorebookAssignment[] = [];
    const characterOverrides: ScenarioCharacterOverride[] = [];

    for (const assignment of assignments) {
      if (assignment.kind === "manual") {
        manualAssignments.push({
          lorebookId: assignment.lorebookId,
          enabled: assignment.enabled ?? true,
        });
        continue;
      }

      characterOverrides.push({
        characterLorebookId: assignment.characterLorebookId,
        enabled: assignment.enabled ?? true,
      });
    }

    const work = async (tx: SqliteTransaction) => {
      await this.syncManualAssignments(tx, scenarioId, manualAssignments);
      await this.syncCharacterOverrides(tx, scenarioId, characterOverrides);
    };

    await (outerTx ? work(outerTx) : this.db.transaction(work));
  }

  private async syncManualAssignments(
    tx: SqliteTransaction,
    scenarioId: string,
    assignments: readonly ManualScenarioLorebookAssignment[]
  ) {
    const existing = await tx
      .select({
        id: schema.scenarioLorebooks.id,
        lorebookId: schema.scenarioLorebooks.lorebookId,
        enabled: schema.scenarioLorebooks.enabled,
      })
      .from(schema.scenarioLorebooks)
      .where(eq(schema.scenarioLorebooks.scenarioId, scenarioId));

    const existingByLorebookId = new Map(existing.map((row) => [row.lorebookId, row]));
    const targetLorebookIds = new Set(assignments.map((assignment) => assignment.lorebookId));

    for (const assignment of assignments) {
      const current = existingByLorebookId.get(assignment.lorebookId);
      if (current) {
        if (current.enabled !== assignment.enabled) {
          await tx
            .update(schema.scenarioLorebooks)
            .set({ enabled: assignment.enabled })
            .where(eq(schema.scenarioLorebooks.id, current.id));
        }
        continue;
      }

      await tx.insert(schema.scenarioLorebooks).values({
        scenarioId,
        lorebookId: assignment.lorebookId,
        enabled: assignment.enabled,
      });
    }

    const idsToRemove = existing
      .filter((row) => !targetLorebookIds.has(row.lorebookId))
      .map((row) => row.id);

    if (idsToRemove.length > 0) {
      await tx
        .delete(schema.scenarioLorebooks)
        .where(inArray(schema.scenarioLorebooks.id, idsToRemove));
    }
  }

  private async syncCharacterOverrides(
    tx: SqliteTransaction,
    scenarioId: string,
    overrides: readonly ScenarioCharacterOverride[]
  ) {
    const existing = await tx
      .select({
        id: schema.scenarioCharacterLorebookOverrides.id,
        characterLorebookId: schema.scenarioCharacterLorebookOverrides.characterLorebookId,
        enabled: schema.scenarioCharacterLorebookOverrides.enabled,
      })
      .from(schema.scenarioCharacterLorebookOverrides)
      .where(eq(schema.scenarioCharacterLorebookOverrides.scenarioId, scenarioId));

    const existingByCharacterLorebookId = new Map(
      existing.map((row) => [row.characterLorebookId, row])
    );
    const targetIds = new Set(overrides.map((override) => override.characterLorebookId));

    for (const override of overrides) {
      const current = existingByCharacterLorebookId.get(override.characterLorebookId);
      if (current) {
        if (current.enabled !== override.enabled) {
          await tx
            .update(schema.scenarioCharacterLorebookOverrides)
            .set({ enabled: override.enabled })
            .where(eq(schema.scenarioCharacterLorebookOverrides.id, current.id));
        }
        continue;
      }

      await tx.insert(schema.scenarioCharacterLorebookOverrides).values({
        scenarioId,
        characterLorebookId: override.characterLorebookId,
        enabled: override.enabled,
      });
    }

    const overridesToRemove = existing
      .filter((row) => !targetIds.has(row.characterLorebookId))
      .map((row) => row.id);

    if (overridesToRemove.length > 0) {
      await tx
        .delete(schema.scenarioCharacterLorebookOverrides)
        .where(inArray(schema.scenarioCharacterLorebookOverrides.id, overridesToRemove));
    }
  }

  async linkLorebookToCharacter(args: LinkCharacterLorebookInput) {
    const existing = await this.db
      .select()
      .from(schema.characterLorebooks)
      .where(
        and(
          eq(schema.characterLorebooks.characterId, args.characterId),
          eq(schema.characterLorebooks.lorebookId, args.lorebookId)
        )
      )
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    const [inserted] = await this.db.insert(schema.characterLorebooks).values(args).returning();

    return inserted;
  }

  async unlinkLorebookFromCharacter(args: LinkCharacterLorebookInput) {
    await this.db
      .delete(schema.characterLorebooks)
      .where(
        and(
          eq(schema.characterLorebooks.characterId, args.characterId),
          eq(schema.characterLorebooks.lorebookId, args.lorebookId)
        )
      );
  }

  async createLorebookFromCharacterCard(options: {
    characterId: string;
    linkToCharacter?: boolean;
  }) {
    const { characterId, linkToCharacter = true } = options;

    const rows = await this.db
      .select({
        id: schema.characters.id,
        name: schema.characters.name,
        tavernCardData: schema.characters.tavernCardData,
      })
      .from(schema.characters)
      .where(eq(schema.characters.id, characterId))
      .limit(1);

    const character = rows[0];
    if (!character) {
      throw new ServiceError("NotFound", {
        message: `Character ${characterId} not found.`,
      });
    }

    if (character.tavernCardData == null) {
      throw new ServiceError("InvalidInput", {
        message: "Character does not have Tavern card data to extract a character book.",
      });
    }

    const rawCard = coerceTavernCard(character.tavernCardData);
    const book = extractCharacterBook(rawCard);
    if (!book) {
      throw new ServiceError("InvalidInput", {
        message: "Character card does not include a character book.",
      });
    }

    const lorebookData: LorebookData = {
      name: book.name ?? `${character.name} Lorebook`,
      description: book.description,
      scan_depth: book.scan_depth,
      token_budget: book.token_budget,
      recursive_scanning: book.recursive_scanning,
      extensions: book.extensions ?? {},
      entries: book.entries.map((entry) => ({
        keys: [...entry.keys],
        content: entry.content,
        extensions: entry.extensions ?? {},
        enabled: entry.enabled,
        insertion_order: entry.insertion_order,
        case_sensitive: entry.case_sensitive,
        name: entry.name,
        priority: entry.priority,
        id: entry.id,
        comment: entry.comment,
        selective: entry.selective,
        secondary_keys: entry.secondary_keys ? [...entry.secondary_keys] : undefined,
        constant: entry.constant,
        position: entry.position,
      })),
    };

    const result = await this.createLorebook({ data: lorebookData, source: "character_book" });

    if (linkToCharacter) {
      await this.linkLorebookToCharacter({
        characterId,
        lorebookId: result.lorebook.id,
      });
    }

    return result;
  }
}

function decodeDataUri(dataUri: string) {
  const match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) {
    throw new ServiceError("InvalidInput", {
      message: "Invalid file data URI provided for lorebook import.",
    });
  }

  return Buffer.from(match[1], "base64");
}

function parseJson(payload: string) {
  try {
    return JSON.parse(payload) as unknown;
  } catch (error) {
    throw new ServiceError("InvalidInput", {
      message: "Lorebook import file is not valid JSON.",
      cause: error,
    });
  }
}

function coerceLorebookData(raw: unknown): LorebookData {
  if (isLorebookWrapper(raw)) {
    return parseLorebookData(raw.data);
  }

  return parseLorebookData(raw);
}

function coerceTavernCard(value: unknown) {
  if (typeof value === "string") {
    return parseJson(value);
  }

  return value;
}

function extractCharacterBook(raw: unknown) {
  if (!isTavernCardV2(raw)) {
    return undefined;
  }

  if (!raw.data.character_book) {
    return undefined;
  }

  return CharacterBookSchema.parse(raw.data.character_book);
}

function isTavernCardV2(value: unknown): value is {
  spec: string;
  spec_version?: string;
  data: { character_book?: unknown } & Record<string, unknown>;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const card = value as {
    spec?: unknown;
    data?: unknown;
  };

  if (card.spec !== "chara_card_v2") {
    return false;
  }

  if (typeof card.data !== "object" || card.data === null) {
    return false;
  }

  return true;
}

function isLorebookWrapper(value: unknown): value is { spec: string; data: unknown } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const maybe = value as { spec?: unknown; data?: unknown };
  return maybe.spec === "lorebook_v3" && maybe.data !== undefined;
}
