import type { Character as DbCharacter } from "@storyforge/db";
import type {
  Character as ApiCharacter,
  CharacterSummary as ApiCharacterSummary,
} from "@storyforge/schemas";

/**
 * Transforms a database character record to API format
 */
export function transformCharacter(dbCharacter: DbCharacter): ApiCharacter {
  return {
    id: dbCharacter.id,
    name: dbCharacter.name,
    description: dbCharacter.description,
    cardType: dbCharacter.cardType,
    legacyPersonality: dbCharacter.legacyPersonality,
    legacyScenario: dbCharacter.legacyScenario,
    creator: dbCharacter.creator,
    creatorNotes: dbCharacter.creatorNotes,
    customSystemPrompt: dbCharacter.customSystemPrompt,
    customPostHistoryInstructions: dbCharacter.customPostHistoryInstructions,
    tags: dbCharacter.tags || [],
    revision: dbCharacter.revision,
    tavernCardData: dbCharacter.tavernCardData
      ? JSON.parse(JSON.stringify(dbCharacter.tavernCardData))
      : null,
    imagePath: dbCharacter.portrait
      ? `/assets/characters/${dbCharacter.id}/card`
      : null,
    avatarPath: dbCharacter.portrait
      ? `/assets/characters/${dbCharacter.id}/avatar`
      : null,
    createdAt: dbCharacter.createdAt,
    updatedAt: dbCharacter.updatedAt,
  };
}

export function transformCharacterSummary(
  charaSummary: Pick<
    DbCharacter,
    | "id"
    | "name"
    | "createdAt"
    | "updatedAt"
    | "cardType"
    | "tags"
    | "creatorNotes"
  > & { hasPortrait: number }
): ApiCharacterSummary {
  return {
    id: charaSummary.id,
    name: charaSummary.name,
    createdAt: charaSummary.createdAt,
    updatedAt: charaSummary.updatedAt,
    cardType: charaSummary.cardType,
    tags: charaSummary.tags || [],
    creatorNotes: charaSummary.creatorNotes,
    imagePath: charaSummary.hasPortrait
      ? `/assets/characters/${charaSummary.id}/card`
      : null,
    avatarPath: charaSummary.hasPortrait
      ? `/assets/characters/${charaSummary.id}/avatar`
      : null,
  };
}
