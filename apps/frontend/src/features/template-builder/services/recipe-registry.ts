import type { TaskKind } from "@storyforge/gentasks";
import { getTaskDescriptor } from "@storyforge/gentasks";
import { chapterSummariesRecipe } from "@/features/template-builder/services/recipes/narrative/chapter-summaries-recipe";
import { charactersRecipe } from "@/features/template-builder/services/recipes/narrative/characters-recipe";
import { nextTurnIntentRecipe } from "@/features/template-builder/services/recipes/narrative/intent-recipes";
import {
  timelineAdvancedRecipe,
  timelineBasicRecipe,
} from "@/features/template-builder/services/recipes/narrative/timeline-recipe";
import type { AnyRecipe, AnyRecipeId } from "@/features/template-builder/types";

export const ALL_RECIPES = {
  characters_basic: charactersRecipe,
  timeline_basic: timelineBasicRecipe,
  timeline_advanced: timelineAdvancedRecipe,
  intent_basic: nextTurnIntentRecipe,
  chapter_summaries_basic: chapterSummariesRecipe,
} as const satisfies Record<AnyRecipeId, AnyRecipe>;

function normalizeRequires(recipe: AnyRecipe): readonly string[] {
  return recipe.requires.map((key) => String(key));
}

export function isRecipeCompatibleWithTask(recipe: AnyRecipe, task: TaskKind): boolean {
  const provided = new Set(getTaskDescriptor(task).providedSources.map((key) => String(key)));
  return normalizeRequires(recipe).every((key) => provided.has(key));
}

export function getRecipesForTask<K extends TaskKind>(task: K): AnyRecipe[] {
  return Object.values(ALL_RECIPES).filter((recipe) => isRecipeCompatibleWithTask(recipe, task));
}

export function getRecipeIdsForTask<K extends TaskKind>(task: K): AnyRecipeId[] {
  return getRecipesForTask(task).map((recipe) => recipe.id);
}

export function getRecipeById<I extends keyof typeof ALL_RECIPES>(id: I): (typeof ALL_RECIPES)[I];
export function getRecipeById(id: string): AnyRecipe | undefined;
export function getRecipeById(id: string): AnyRecipe | undefined {
  return ALL_RECIPES[id as keyof typeof ALL_RECIPES] as AnyRecipe | undefined;
}

export function getAllRecipeIds(): AnyRecipeId[] {
  return Object.keys(ALL_RECIPES) as AnyRecipeId[];
}

export function isValidRecipeId(id: string): id is AnyRecipeId {
  return id in ALL_RECIPES;
}

export function assertRecipeCompatibleWithTask(task: TaskKind, recipe: AnyRecipe): void {
  if (!isRecipeCompatibleWithTask(recipe, task)) {
    throw new Error(
      `Recipe "${recipe.id}" requires sources [${normalizeRequires(recipe).join(", ")}], ` +
        `which task "${task}" does not provide.`
    );
  }
}
