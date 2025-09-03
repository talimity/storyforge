import type { SourcesFor, TaskKind } from "@storyforge/gentasks";
import type {
  ChatCompletionMessageRole,
  SlotSpec,
  SourceSpec,
  UnboundDataRef,
} from "@storyforge/prompt-rendering";

// Per-task recipe IDs
export type TurnGenRecipeId = "timeline_basic" | "characters_basic";
export type ChapterSummRecipeId = never; // none yet
export type WritingAssistantRecipeId = never; // none yet

// Map task kind to its recipe ID union
export type RecipeId<K extends TaskKind> = K extends "turn_generation"
  ? TurnGenRecipeId
  : K extends "chapter_summarization"
    ? ChapterSummRecipeId
    : K extends "writing_assistant"
      ? WritingAssistantRecipeId
      : never;
export type AnyRecipeId = RecipeId<TaskKind>;

/** Represents a recipe for a specific task kind and its associated sources */
type RecipeOf<K extends TaskKind> = RecipeDefinition<K, SourcesFor<K>>;

// Concrete per-task shapes
export type TurnGenRecipe = RecipeOf<"turn_generation">;
export type ChapterSummRecipe = RecipeOf<"chapter_summarization">;
export type WritingAssistantRecipe = RecipeOf<"writing_assistant">;
export type AnyRecipe =
  | TurnGenRecipe
  | ChapterSummRecipe
  | WritingAssistantRecipe;

/** Alias for "the member of the union for this task" */
export type TypedRecipe<K extends TaskKind> = Extract<AnyRecipe, { task: K }>;

/**
 * Represents a parameter that can be configured by the user when selecting a
 * recipe. This defines the UI controls and validation for the parameter.
 */
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

/**
 * Definition of a recipe for generating a prompt template slot. Includes
 * metadata, parameter specifications, and a function to convert user parameters
 * into valid DSL SlotSpec.
 */
export interface RecipeDefinition<K extends TaskKind, S extends SourceSpec> {
  id: RecipeId<K>;
  name: string;
  task: K;
  description?: string;
  parameters: RecipeParamSpec[];

  /**
   * Transform the user's parameter values into a complete SlotSpec
   * that can be used by the prompt renderer engine
   */
  toSlotSpec(params: Record<string, unknown>): Omit<SlotSpec<S>, "priority">;

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

// Top-level template draft type for UI
export interface TemplateDraft<K extends TaskKind = TaskKind> {
  id: string;
  name: string;
  description?: string;
  task: K;
  layoutDraft: LayoutNodeDraft[];
  slotsDraft: Record<string, SlotDraft>;
}

// Base interface for layout nodes with UI tracking
interface BaseLayoutNodeDraft {
  id: string; // UI tracking ID
}

export interface MessageLayoutDraft extends BaseLayoutNodeDraft {
  kind: "message";
  name?: string;
  role: ChatCompletionMessageRole;
  content?: string;
  from?: UnboundDataRef;
  prefix?: boolean;
}

export interface SlotLayoutDraft extends BaseLayoutNodeDraft {
  kind: "slot";
  name: string;
  header?: MessageBlockDraft | MessageBlockDraft[];
  footer?: MessageBlockDraft | MessageBlockDraft[];
  omitIfEmpty?: boolean;
}

// Union type for layout nodes
export type LayoutNodeDraft = MessageLayoutDraft | SlotLayoutDraft;

// Message block for headers/footers
export interface MessageBlockDraft {
  role: ChatCompletionMessageRole;
  content?: string;
  from?: UnboundDataRef;
  prefix?: boolean;
}

// Slot configuration in UI
export interface SlotDraft<K extends TaskKind = TaskKind> {
  recipeId: RecipeId<K> | "custom";
  params: Record<string, unknown>;
  name: string;
  priority: number;
  budget?: number; // Simplified to just maxTokens for UI
  customSpec?: string; // For custom slots, this is a JSON string of its SlotSpec
}
