import type { SlotSpec, TaskKind } from "@storyforge/prompt-renderer";
import { z } from "zod";
import { charactersRecipe } from "@/components/features/templates/recipes/turngen/characters-recipe";
import { timelineRecipe } from "@/components/features/templates/recipes/turngen/timeline-recipe";
import type { SlotRecipeId } from "@/components/features/templates/types";

// Recipe parameter specification for form generation
export interface RecipeParamSpec {
  key: string;
  label: string;
  type: "number" | "select" | "toggle" | "template_string";
  defaultValue?: unknown;
  help?: string;
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string | number | boolean }>;
}

/** Recipe definition interface */
export interface RecipeDefinition {
  id: SlotRecipeId;
  name: string;
  task: TaskKind;
  description?: string;
  parameters: RecipeParamSpec[];

  /**
   * Transform the user's parameter values into a complete SlotSpec
   * that can be used by the prompt renderer engine
   */
  toSlotSpec(params: Record<string, unknown>): SlotSpec;

  /**
   * Optional: Available variables that can be used in template_string parameters
   * These will be shown as hints in the UI
   */
  availableVariables?: Array<{
    name: string;
    description: string;
    example?: string;
  }>;
}

export const recipeMetaSchema = z
  .object({
    recipe: z.object({
      id: z.string(),
      params: z.record(z.string(), z.unknown()),
    }),
  })
  .loose();
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
