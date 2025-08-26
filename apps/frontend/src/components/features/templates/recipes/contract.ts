import type { SlotSpec, TaskKind } from "@storyforge/prompt-renderer";
import type { SlotRecipeId } from "../types";

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

// Recipe definition interface
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
