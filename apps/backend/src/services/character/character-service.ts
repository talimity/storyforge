import type {
  CharacterExample,
  CharacterStarter,
  NewCharacter,
  NewCharacterExample,
  NewCharacterStarter,
  SqliteDatabase,
} from "@storyforge/db";
import { schema } from "@storyforge/db";
import { eq } from "drizzle-orm";
import { identifyCharacterFace } from "./utils/face-detection.js";
import {
  parseTavernCard,
  type TavernCard,
  type TavernCardV1,
  type TavernCardV2,
} from "./utils/parse-tavern-card.js";

export class CharacterService {
  constructor(private db: SqliteDatabase) {}

  async createCharacter({
    characterData,
    starters = [],
    examples = [],
  }: {
    characterData: NewCharacter;
    starters?: NewCharacterStarter[];
    examples?: NewCharacterExample[];
  }) {
    return this.db.transaction(async (tx) => {
      const characters = await tx.insert(schema.characters).values(characterData).returning();

      const character = characters[0];

      if (!character) {
        throw new Error("Failed to create character");
      }

      const createdStarters: CharacterStarter[] = [];
      const createdExamples: CharacterExample[] = [];

      if (starters.length > 0) {
        for (const starter of starters) {
          const [created] = await tx
            .insert(schema.characterStarters)
            .values({ ...starter, characterId: character.id })
            .returning();

          if (!created) {
            throw new Error("Failed to create starter");
          }
          createdStarters.push(created);
        }
      }

      if (examples.length > 0) {
        for (const example of examples) {
          const [created] = await tx
            .insert(schema.characterExamples)
            .values({ ...example, characterId: character.id })
            .returning();

          if (!created) {
            throw new Error("Failed to create example");
          }
          createdExamples.push(created);
        }
      }

      return {
        ...character,
        starters: createdStarters,
        examples: createdExamples,
      };
    });
  }

  async setCharacterStarters(
    characterId: string,
    starters: Array<Pick<NewCharacterStarter, "message" | "isPrimary"> & { id?: string }>
  ) {
    return this.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(schema.characterStarters)
        .where(eq(schema.characterStarters.characterId, characterId));

      const existingById = new Map(existing.map((s) => [s.id, s] as const));
      const incomingIds = new Set(starters.map((s) => s.id).filter((v): v is string => !!v));

      // Delete starters that are not present anymore (precise per-id delete)
      const toDelete = existing.filter((s) => !incomingIds.has(s.id));
      for (const s of toDelete) {
        await tx.delete(schema.characterStarters).where(eq(schema.characterStarters.id, s.id));
      }

      // Upsert remaining
      for (const starter of starters) {
        if (starter.id && existingById.has(starter.id)) {
          await tx
            .update(schema.characterStarters)
            .set({ message: starter.message, isPrimary: starter.isPrimary })
            .where(eq(schema.characterStarters.id, starter.id));
        } else {
          await tx.insert(schema.characterStarters).values({
            characterId,
            message: starter.message,
            isPrimary: starter.isPrimary,
          });
        }
      }

      const refreshed = await tx
        .select()
        .from(schema.characterStarters)
        .where(eq(schema.characterStarters.characterId, characterId))
        .orderBy(schema.characterStarters.isPrimary, schema.characterStarters.createdAt);

      return refreshed;
    });
  }
  async updateCharacter(id: string, data: Partial<NewCharacter>) {
    const [updated] = await this.db
      .update(schema.characters)
      .set(data)
      .where(eq(schema.characters.id, id))
      .returning();

    return updated;
  }

  async deleteCharacter(id: string) {
    const result = await this.db
      .delete(schema.characters)
      .where(eq(schema.characters.id, id))
      .returning();

    return result.length > 0;
  }

  async importCharacterFromTavernCard(buf: Buffer<ArrayBuffer>) {
    const { cardData } = await parseTavernCard(buf.buffer);
    const focalPoint = await identifyCharacterFace(buf);

    if (isTavernCardV2(cardData)) {
      return this.importV2Character(cardData, buf, focalPoint);
    } else {
      return this.importV1Character(cardData, buf, focalPoint);
    }
  }

  private async importV2Character(
    card: TavernCardV2,
    imageBuffer: Buffer,
    focalPoint: NewCharacter["portraitFocalPoint"]
  ) {
    const characterData = {
      name: card.data.name,
      description: card.data.description,
      cardType: "character" as const,
      legacyPersonality: card.data.personality,
      legacyScenario: card.data.scenario,
      creator: card.data.creator,
      creatorNotes: card.data.creator_notes,
      customSystemPrompt: card.data.system_prompt,
      styleInstructions: card.data.post_history_instructions,
      tags: card.data.tags,
      revision: card.data.character_version,
      tavernCardData: JSON.stringify(card),
      portrait: imageBuffer,
      portraitFocalPoint: focalPoint,
    };

    const starters: NewCharacterStarter[] = [];
    const examples: NewCharacterExample[] = [];

    if (card.data.first_mes) {
      starters.push({ message: card.data.first_mes, isPrimary: true });
    }

    if (card.data.alternate_greetings?.length > 0) {
      for (const greeting of card.data.alternate_greetings) {
        starters.push({ message: greeting, isPrimary: false });
      }
    }

    if (card.data.mes_example) {
      examples.push({
        exampleTemplate: card.data.mes_example,
      });
    }

    return await this.createCharacter({ characterData, starters, examples });
  }

  private async importV1Character(
    card: TavernCardV1,
    imageBuffer: Buffer,
    focalPoint: NewCharacter["portraitFocalPoint"]
  ) {
    const characterData = {
      name: card.name,
      description: card.description,
      cardType: "character" as const,
      legacyPersonality: card.personality || null,
      legacyScenario: card.scenario || null,
      creator: null,
      creatorNotes: null,
      customSystemPrompt: null,
      styleInstructions: null,
      tags: [],
      revision: null,
      tavernCardData: JSON.stringify(card),
      portrait: imageBuffer,
      portraitFocalPoint: focalPoint,
    };

    const starters: NewCharacterStarter[] = [];
    const examples: NewCharacterExample[] = [];

    if (card.first_mes) {
      starters.push({ message: card.first_mes, isPrimary: true });
    }

    if (card.mes_example) {
      examples.push({ exampleTemplate: card.mes_example });
    }

    return await this.createCharacter({ characterData, starters, examples });
  }
}

function isTavernCardV2(card: TavernCard): card is TavernCardV2 {
  return "spec" in card && card.spec === "chara_card_v2";
}
