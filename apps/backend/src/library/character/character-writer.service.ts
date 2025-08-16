import type {
  CharacterExample,
  CharacterGreeting,
  NewCharacter,
  NewCharacterExample,
  NewCharacterGreeting,
  StoryforgeSqliteDatabase,
} from "@storyforge/db";
import { schema } from "@storyforge/db";
import { eq } from "drizzle-orm";
import { identifyCharacterFace } from "@/library/character/utils/face-detection";
import {
  parseTavernCard,
  type TavernCard,
  type TavernCardV1,
  type TavernCardV2,
} from "@/library/character/utils/parse-tavern-card";

export class CharacterWriterService {
  constructor(private db: StoryforgeSqliteDatabase) {}

  async createCharacter({
    characterData,
    greetings = [],
    examples = [],
  }: {
    characterData: NewCharacter;
    greetings?: NewCharacterGreeting[];
    examples?: NewCharacterExample[];
  }) {
    return this.db.transaction((tx) => {
      const characters = tx
        .insert(schema.characters)
        .values(characterData)
        .returning()
        .all();

      const character = characters[0];

      if (!character) {
        throw new Error("Failed to create character");
      }

      const createdGreetings: CharacterGreeting[] = [];
      const createdExamples: CharacterExample[] = [];

      if (greetings.length > 0) {
        for (const greeting of greetings) {
          const created = tx
            .insert(schema.characterGreetings)
            .values({ ...greeting, characterId: character.id })
            .returning()
            .all()[0];

          if (!created) {
            throw new Error("Failed to create greeting");
          }
          createdGreetings.push(created);
        }
      }

      if (examples.length > 0) {
        for (const example of examples) {
          const created = tx
            .insert(schema.characterExamples)
            .values({ ...example, characterId: character.id })
            .returning()
            .all()[0];

          if (!created) {
            throw new Error("Failed to create example");
          }
          createdExamples.push(created);
        }
      }

      return {
        ...character,
        greetings: createdGreetings,
        examples: createdExamples,
      };
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
      customPostHistoryInstructions: card.data.post_history_instructions,
      tags: card.data.tags,
      revision: card.data.character_version,
      tavernCardData: JSON.stringify(card),
      portrait: imageBuffer,
      portraitFocalPoint: focalPoint,
    };

    const greetings: NewCharacterGreeting[] = [];
    const examples: NewCharacterExample[] = [];

    if (card.data.first_mes) {
      greetings.push({ message: card.data.first_mes, isPrimary: true });
    }

    if (card.data.alternate_greetings?.length > 0) {
      for (const greeting of card.data.alternate_greetings) {
        greetings.push({ message: greeting, isPrimary: false });
      }
    }

    if (card.data.mes_example) {
      examples.push({
        exampleTemplate: card.data.mes_example,
      });
    }

    return await this.createCharacter({ characterData, greetings, examples });
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
      customPostHistoryInstructions: null,
      tags: [],
      revision: null,
      tavernCardData: JSON.stringify(card),
      portrait: imageBuffer,
      portraitFocalPoint: focalPoint,
    };

    const greetings: NewCharacterGreeting[] = [];
    const examples: NewCharacterExample[] = [];

    if (card.first_mes) {
      greetings.push({ message: card.first_mes, isPrimary: true });
    }

    if (card.mes_example) {
      examples.push({ exampleTemplate: card.mes_example });
    }

    return await this.createCharacter({ characterData, greetings, examples });
  }
}

function isTavernCardV2(card: TavernCard): card is TavernCardV2 {
  return "spec" in card && card.spec === "chara_card_v2";
}
