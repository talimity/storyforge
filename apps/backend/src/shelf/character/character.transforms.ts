import type { Character } from "@storyforge/api";
import type { Character as DbCharacter } from "@storyforge/db";

/**
 * Transforms a database character record to API format
 * (Reuses existing character transformation pattern)
 */

export function transformCharacter(dbCharacter: DbCharacter): Character {
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
