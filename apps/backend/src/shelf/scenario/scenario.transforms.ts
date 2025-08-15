import type {
  ScenarioParticipant,
  ScenarioWithCharacters,
} from "@storyforge/api";
import type {
  JoinedScenarioParticipant as DbScenarioParticipant,
  ScenarioWithCharacters as DbScenarioWithCharacters,
} from "@storyforge/db";

import { transformCharacter } from "../character/character.transforms";

/**
 * Transforms a repository-level ScenarioParticipant to API format
 */
export function transformScenarioParticipant(
  dbParticipant: DbScenarioParticipant
): ScenarioParticipant {
  return {
    id: dbParticipant.id,
    scenarioId: dbParticipant.scenarioId,
    characterId: dbParticipant.characterId,
    role: dbParticipant.role,
    orderIndex: dbParticipant.orderIndex,
    assignedAt: dbParticipant.assignedAt,
    unassignedAt: dbParticipant.unassignedAt,
    isActive: dbParticipant.isActive,
    character: transformCharacter(dbParticipant.character),
  };
}

/**
 * Transforms a repository-level ScenarioWithCharacters to API format
 */
export function transformScenarioWithCharacters(
  repoScenario: DbScenarioWithCharacters
): ScenarioWithCharacters {
  return {
    id: repoScenario.id,
    name: repoScenario.name,
    description: repoScenario.description,
    status: repoScenario.status as "active" | "archived",
    settings: repoScenario.settings,
    metadata: repoScenario.metadata,
    createdAt: repoScenario.createdAt,
    updatedAt: repoScenario.updatedAt,
    characters: repoScenario.characters.map(transformScenarioParticipant),
  };
}
