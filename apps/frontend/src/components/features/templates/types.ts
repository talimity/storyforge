import type {
  ChatCompletionMessageRole,
  DataRef,
  TaskKind,
} from "@storyforge/prompt-rendering";

// Recipe ID for identifying slot recipes
export type SlotRecipeId = "timeline_basic" | "characters_basic";

// Top-level template draft type for UI
export interface TemplateDraft {
  id: string;
  name: string;
  description?: string;
  task: TaskKind;
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
  from?: DataRef;
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
  from?: DataRef;
  prefix?: boolean;
}

// Slot configuration in UI
export interface SlotDraft {
  recipeId: SlotRecipeId | "custom";
  params: Record<string, unknown>;
  name: string;
  priority: number;
  budget?: number; // Simplified to just maxTokens for UI
  customSpec?: string; // For custom slots, this is a JSON string of its SlotSpec
}

// Parameter specification for recipe forms
export interface ParamSpec {
  key: string;
  label: string;
  type: "number" | "select" | "toggle" | "template_string";
  defaultValue?: unknown;
  help?: string;
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string | number | boolean }>;
}
