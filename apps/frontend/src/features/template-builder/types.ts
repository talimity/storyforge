import type { TaskKind, TaskSourcesMap } from "@storyforge/gentasks";
import type {
  ChatCompletionMessageRole,
  ConditionRef,
  SlotSpec,
  SourceSpec,
  UnboundDataRef,
} from "@storyforge/prompt-rendering";
import type {
  AttachmentLaneDraftBase,
  LoreAttachmentFormValues,
  LoreAttachmentLaneDraft,
} from "@/features/template-builder/services/attachments/types";

// Per-task recipe IDs
export type TurnGenRecipeId =
  | "timeline_basic"
  | "timeline_advanced"
  | "characters_basic"
  | "intent_basic";
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
type RecipeOf<K extends TaskKind> = RecipeDefinition<K, TaskSourcesMap[K]>;

// Concrete per-task shapes
export type TurnGenRecipe = RecipeOf<"turn_generation">;
export type ChapterSummRecipe = RecipeOf<"chapter_summarization">;
export type WritingAssistantRecipe = RecipeOf<"writing_assistant">;
export type AnyRecipe = TurnGenRecipe | ChapterSummRecipe | WritingAssistantRecipe;

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
  infoTip?: string;
  min?: number;
  max?: number;
  options?: readonly { label: string; value: string | number | boolean }[];
}

/**
 * Extracts the TypeScript type for a single RecipeParamSpec
 */
export type InferParamType<T extends RecipeParamSpec> = T["type"] extends "select"
  ? T extends { options: readonly { value: infer V }[] }
    ? V
    : string
  : T["type"] extends "number"
    ? number
    : T["type"] extends "toggle"
      ? boolean
      : T["type"] extends "template_string"
        ? string
        : unknown;

/**
 * Infers the parameter types from an array of RecipeParamSpec
 * Returns a record mapping parameter keys to their inferred types
 */
export type InferRecipeParams<T extends readonly RecipeParamSpec[]> = {
  [K in T[number] as K["key"]]: InferParamType<K>;
};

/**
 * Definition of a recipe for generating a prompt template slot. Includes
 * metadata, parameter specifications, and a function to convert user parameters
 * into valid DSL SlotSpec.
 */
export interface RecipeDefinition<
  K extends TaskKind,
  S extends SourceSpec,
  P extends readonly RecipeParamSpec[] = readonly RecipeParamSpec[],
> {
  id: RecipeId<K>;
  name: string;
  task: K;
  description?: string;
  parameters: P;

  /**
   * Transform the user's parameter values into a complete SlotSpec
   * that can be used by the prompt renderer engine.
   *
   * Parameters are automatically coerced/clamped using the type constraints
   * and min/max/default values specified in the RecipeParamSpec.
   */
  toSlotSpec(params: InferRecipeParams<P>): Omit<SlotSpec<S>, "priority">;

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
  attachmentDrafts: Record<string, AttachmentLaneDraft>;
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
  when?: ConditionRef[];
}

export interface SlotLayoutDraft extends BaseLayoutNodeDraft {
  kind: "slot";
  name: string;
  header?: MessageBlockDraft;
  footer?: MessageBlockDraft;
  omitIfEmpty?: boolean;
}

// Union type for layout nodes
export type LayoutNodeDraft = MessageLayoutDraft | SlotLayoutDraft;

// Message block for headers/footers
export interface MessageBlockDraft {
  role: ChatCompletionMessageRole;
  content?: string;
  from?: UnboundDataRef;
  when?: ConditionRef[];
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

export type AttachmentLaneDraft = LoreAttachmentLaneDraft;

export type { LoreAttachmentFormValues, AttachmentLaneDraftBase };
