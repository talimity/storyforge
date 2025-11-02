import type { NarrativeSourcesBase, TaskKind, TurnGenSources } from "@storyforge/gentasks";
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

export type BaseRecipeId =
  | "timeline_basic"
  | "timeline_advanced"
  | "characters_basic"
  | "intent_basic";

export type RecipeId<_K extends TaskKind = TaskKind> = BaseRecipeId;
export type AnyRecipeId = BaseRecipeId;
export type AnyRecipe = RecipeDefinition<NarrativeSourcesBase> | RecipeDefinition<TurnGenSources>;

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
  S extends SourceSpec,
  P extends readonly RecipeParamSpec[] = readonly RecipeParamSpec[],
> {
  id: AnyRecipeId;
  name: string;
  description?: string;
  parameters: P;
  /** Names of sources this recipe requires */
  requires: readonly (keyof S)[];
  buildSlotLayout?: (params: InferRecipeParams<P>) => {
    header?: SlotFrameNodeDraft[];
    footer?: SlotFrameNodeDraft[];
    omitIfEmpty?: boolean;
  };

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

export function defineRecipe<S extends SourceSpec, P extends readonly RecipeParamSpec[]>(
  recipe: RecipeDefinition<S, P>
): RecipeDefinition<S, P> {
  return recipe;
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

export type SlotFrameAnchorDraft = {
  kind: "anchor";
  key: string;
  when?: ConditionRef[];
};

export type SlotFrameNodeDraft = MessageBlockDraft | SlotFrameAnchorDraft;

export interface SlotLayoutDraft extends BaseLayoutNodeDraft {
  kind: "slot";
  name: string;
  header?: SlotFrameNodeDraft[];
  footer?: SlotFrameNodeDraft[];
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
export interface SlotDraft {
  recipeId: AnyRecipeId | "custom";
  params: Record<string, unknown>;
  name: string;
  priority: number;
  budget?: number; // Simplified to just maxTokens for UI
  customSpec?: string; // For custom slots, this is a JSON string of its SlotSpec
}

export type AttachmentLaneDraft = LoreAttachmentLaneDraft;

export type { LoreAttachmentFormValues, AttachmentLaneDraftBase };
