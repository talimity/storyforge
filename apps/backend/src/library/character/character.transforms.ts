import type { Character as DbCharacter } from "@storyforge/db";
import type {
  Character as ApiCharacter,
  CharacterSummary as ApiCharacterSummary,
} from "@storyforge/schemas";
import { getCharaAssetPaths } from "./utils/chara-asset-helpers";

// TODO: don't use this file. queries should select exactly what they need to
// satisfy whatever procedure they're used in and return that directly. no more
// transformations should be added here.

/**
 * Transforms a database character record to API format
 *
 * @deprecated
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
    ...getCharaAssetPaths(dbCharacter),
    createdAt: dbCharacter.createdAt,
    updatedAt: dbCharacter.updatedAt,
  };
}

/**
 * @deprecated
 */
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
    ...getCharaAssetPaths(charaSummary),
  };
}
