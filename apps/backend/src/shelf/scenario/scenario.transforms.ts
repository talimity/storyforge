import type {
  ScenarioCharacterAssignment,
  ScenarioWithCharacters,
} from "@storyforge/api";
import type {
  ScenarioCharacterAssignment as DbScenarioCharacterAssignment,
  ScenarioWithCharacters as DbScenarioWithCharacters,
} from "@storyforge/db";

import { transformCharacter } from "../character/character.transforms";

/**
 * Transforms a repository-level ScenarioCharacterAssignment to API format
 */
export function transformScenarioCharacterAssignment(
  repoAssignment: DbScenarioCharacterAssignment
): ScenarioCharacterAssignment {
  return {
    id: repoAssignment.id,
    scenarioId: repoAssignment.scenarioId,
    characterId: repoAssignment.characterId,
    role: repoAssignment.role,
    orderIndex: repoAssignment.orderIndex,
    assignedAt: repoAssignment.assignedAt,
    unassignedAt: repoAssignment.unassignedAt,
    isActive: repoAssignment.isActive,
    character: transformCharacter(repoAssignment.character),
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
    characters: repoScenario.characters.map(
      transformScenarioCharacterAssignment
    ),
  };
}
