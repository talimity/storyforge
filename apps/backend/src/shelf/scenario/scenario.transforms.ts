import type {
  ScenarioCharacterAssignment,
  ScenarioWithCharacters,
} from "@storyforge/api";
import type { Character as DbCharacter } from "../../db/schema/characters";
import { transformCharacter } from "../character/character.transforms";

/**
 * Transforms a repository-level ScenarioCharacterAssignment to API format
 */
export function transformScenarioCharacterAssignment(repoAssignment: {
  id: string;
  scenarioId: string;
  characterId: string;
  role: string | null;
  orderIndex: number;
  assignedAt: Date;
  unassignedAt: Date | null;
  character: DbCharacter;
  isActive: boolean;
}): ScenarioCharacterAssignment {
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
export function transformScenarioWithCharacters(repoScenario: {
  id: string;
  name: string;
  description: string;
  status: string;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  characters: Array<{
    id: string;
    scenarioId: string;
    characterId: string;
    role: string | null;
    orderIndex: number;
    assignedAt: Date;
    unassignedAt: Date | null;
    character: DbCharacter;
    isActive: boolean;
  }>;
}): ScenarioWithCharacters {
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
