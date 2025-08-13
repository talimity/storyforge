import type {
  CharacterRepository,
  NewCharacter,
  NewCharacterExample,
  NewCharacterGreeting,
} from "@storyforge/db";
import { identifyCharacterFace } from "@/shelf/character/character-image.service";
import type {
  TavernCard,
  TavernCardV1,
  TavernCardV2,
} from "@/shelf/character/utils/parse-tavern-card";

function isTavernCardV2(card: TavernCard): card is TavernCardV2 {
  return "spec" in card && card.spec === "chara_card_v2";
}

export class CharacterImportService {
  constructor(private repository: CharacterRepository) {}

  async importCharacter(card: TavernCard, imageBuffer: Buffer) {
    const focalPoint = await identifyCharacterFace(imageBuffer);

    if (isTavernCardV2(card)) {
      return this.importV2Character(card, imageBuffer, focalPoint);
    } else {
      return this.importV1Character(card, imageBuffer, focalPoint);
    }
  }

  private async importV2Character(
    card: TavernCardV2,
    imageBuffer: Buffer,
    focalPoint: NewCharacter["portraitFocalPoint"]
  ) {
    const newCharacter = {
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

    return await this.repository.createWithRelations(
      newCharacter,
      greetings,
      examples
    );
  }

  private async importV1Character(
    card: TavernCardV1,
    imageBuffer: Buffer,
    focalPoint: NewCharacter["portraitFocalPoint"]
  ) {
    const newCharacter = {
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

    return await this.repository.createWithRelations(
      newCharacter,
      greetings,
      examples
    );
  }
}
