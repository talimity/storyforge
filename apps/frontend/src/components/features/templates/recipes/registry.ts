import type { TaskKind } from "@storyforge/prompt-renderer";
import type { SlotRecipeId } from "../types";
import type { RecipeDefinition } from "./contract";
import { charactersRecipe } from "./turngen/characters-recipe";
import { timelineRecipe } from "./turngen/timeline-recipe";

// Central registry of all available recipes
export const TURN_GEN_RECIPES = {
  timeline_basic: timelineRecipe,
  characters_basic: charactersRecipe,
} as const satisfies Record<SlotRecipeId, RecipeDefinition>;

// All recipe definitions mapped by ID
export const ALL_RECIPES: Record<SlotRecipeId, RecipeDefinition> = {
  ...TURN_GEN_RECIPES,
  // Future task recipes would be added here
};

/**
 * Get all recipes available for a specific task
 */
export function getRecipesForTask(task: TaskKind): RecipeDefinition[] {
  return Object.values(ALL_RECIPES).filter((recipe) => recipe.task === task);
}

/**
 * Get a specific recipe by ID
 */
export function getRecipeById(id: SlotRecipeId): RecipeDefinition | undefined {
  return ALL_RECIPES[id];
}

/**
 * Get all available recipe IDs
 */
export function getAllRecipeIds(): SlotRecipeId[] {
  return Object.keys(ALL_RECIPES) as SlotRecipeId[];
}

/**
 * Get recipe IDs for a specific task
 */
export function getRecipeIdsForTask(task: TaskKind): SlotRecipeId[] {
  return getRecipesForTask(task).map((recipe) => recipe.id);
}

/**
 * Validate that a recipe ID exists
 */
export function isValidRecipeId(id: string): id is SlotRecipeId {
  return id in ALL_RECIPES;
}
