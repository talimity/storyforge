import { CharacterRepository } from "../repositories/character.repository.js";
import { CharacterGreetingRepository } from "../repositories/character-greeting.repository.js";
import { CharacterExampleRepository } from "../repositories/character-example.repository.js";
import { TavernCard, TavernCardV1, TavernCardV2 } from "@storyforge/shared";
import { NewCharacter } from "../db/schema/characters.js";
import { NewCharacterGreeting } from "../db/schema/character-greetings.js";
import { NewCharacterExample } from "../db/schema/character-examples.js";

export class CharacterImportService {
  constructor(
    private characterRepository: CharacterRepository,
    private greetingRepository: CharacterGreetingRepository,
    private exampleRepository: CharacterExampleRepository
  ) {}

  async importCharacter(card: TavernCard, imageBuffer: Buffer): Promise<string> {
    const isV2 = "spec" in card && card.spec === "chara_card_v2";
    
    if (isV2) {
      return this.importV2Character(card as TavernCardV2, imageBuffer);
    } else {
      return this.importV1Character(card as TavernCardV1, imageBuffer);
    }
  }

  private async importV2Character(card: TavernCardV2, imageBuffer: Buffer): Promise<string> {
    const newCharacter: NewCharacter = {
      name: card.data.name,
      description: card.data.description,
      legacyPersonality: card.data.personality,
      legacyScenario: card.data.scenario,
      creator: card.data.creator,
      creatorNotes: card.data.creator_notes,
      customSystemPrompt: card.data.system_prompt,
      customPostHistoryInstructions: card.data.post_history_instructions,
      tags: card.data.tags,
      sfCharaVersion: card.data.character_version,
      originalCardData: JSON.stringify(card),
      cardImage: imageBuffer,
    };

    const character = await this.characterRepository.create(newCharacter);

    // Import primary greeting
    if (card.data.first_mes) {
      const primaryGreeting: NewCharacterGreeting = {
        characterId: character.id,
        message: card.data.first_mes,
        isPrimary: true,
      };
      await this.greetingRepository.create(primaryGreeting);
    }

    // Import alternate greetings
    if (card.data.alternate_greetings && card.data.alternate_greetings.length > 0) {
      for (const greeting of card.data.alternate_greetings) {
        const alternateGreeting: NewCharacterGreeting = {
          characterId: character.id,
          message: greeting,
          isPrimary: false,
        };
        await this.greetingRepository.create(alternateGreeting);
      }
    }

    // Import message examples
    if (card.data.mes_example) {
      const example: NewCharacterExample = {
        characterId: character.id,
        exampleTemplate: card.data.mes_example,
      };
      await this.exampleRepository.create(example);
    }

    return character.id;
  }

  private async importV1Character(card: TavernCardV1, imageBuffer: Buffer): Promise<string> {
    const newCharacter: NewCharacter = {
      name: card.name,
      description: card.description,
      legacyPersonality: card.personality,
      legacyScenario: card.scenario,
      creator: null,
      creatorNotes: null,
      customSystemPrompt: null,
      customPostHistoryInstructions: null,
      tags: [],
      sfCharaVersion: null,
      originalCardData: JSON.stringify(card),
      cardImage: imageBuffer,
    };

    const character = await this.characterRepository.create(newCharacter);

    // Import primary greeting
    if (card.first_mes) {
      const primaryGreeting: NewCharacterGreeting = {
        characterId: character.id,
        message: card.first_mes,
        isPrimary: true,
      };
      await this.greetingRepository.create(primaryGreeting);
    }

    // Import message examples
    if (card.mes_example) {
      const example: NewCharacterExample = {
        characterId: character.id,
        exampleTemplate: card.mes_example,
      };
      await this.exampleRepository.create(example);
    }

    return character.id;
  }
}