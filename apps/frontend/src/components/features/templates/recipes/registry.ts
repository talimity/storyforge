import type { TaskKind } from "@storyforge/gentasks";
import { charactersRecipe } from "@/components/features/templates/recipes/turngen/characters-recipe";
import { timelineRecipe } from "@/components/features/templates/recipes/turngen/timeline-recipe";
import type {
  AnyRecipe,
  AnyRecipeId,
  ChapterSummRecipe,
  ChapterSummRecipeId,
  RecipeId,
  TurnGenRecipe,
  TurnGenRecipeId,
  TypedRecipe,
  WritingAssistantRecipe,
  WritingAssistantRecipeId,
} from "@/components/features/templates/types";

/** Per-task registries */
export const TURN_GEN_RECIPES = {
  timeline_basic: timelineRecipe,
  characters_basic: charactersRecipe,
} as const satisfies Record<TurnGenRecipeId, TurnGenRecipe>;

export const CHAPTER_SUMM_RECIPES = {
  // TODO
} as const satisfies Record<ChapterSummRecipeId, ChapterSummRecipe>;

export const WRITING_ASSIST_RECIPES = {
  // TODO
} as const satisfies Record<WritingAssistantRecipeId, WritingAssistantRecipe>;

/** Recipes-by-task view */
type ByTask = {
  [K in TaskKind]: Record<RecipeId<K>, TypedRecipe<K>>;
};

const BY_TASK: ByTask = {
  turn_generation: TURN_GEN_RECIPES,
  chapter_summarization: CHAPTER_SUMM_RECIPES,
  writing_assistant: WRITING_ASSIST_RECIPES,
};

/** Flat registry across all tasks */
export const ALL_RECIPES = {
  ...TURN_GEN_RECIPES,
  ...CHAPTER_SUMM_RECIPES,
  ...WRITING_ASSIST_RECIPES,
} as const;

export function getRecipesForTask<K extends TaskKind>(
  task: K
): Array<Extract<AnyRecipe, { task: K }>> {
  return Object.values(BY_TASK[task]);
}

export function getRecipeIdsForTask<K extends TaskKind>(
  task: K
): RecipeId<K>[] {
  return Object.keys(BY_TASK[task]) as RecipeId<K>[];
}

export function getRecipeById<I extends keyof typeof ALL_RECIPES>(id: I) {
  return ALL_RECIPES[id];
}

export function getAllRecipeIds(): AnyRecipeId[] {
  return Object.keys(ALL_RECIPES) as AnyRecipeId[];
}

export function isValidRecipeId(id: string): id is AnyRecipeId {
  return id in ALL_RECIPES;
}

export function assertValidRecipeId(id: string): asserts id is AnyRecipeId {
  if (!isValidRecipeId(id)) {
    throw new Error(`Invalid recipe ID: ${id}`);
  }
}
