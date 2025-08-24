import {
  AuthoringValidationError,
  RenderError,
  TemplateStructureError,
} from "./errors";
import { assembleLayout } from "./layout-assembler";
import { executeSlots } from "./slot-executor";
import type {
  BudgetManager,
  ChatCompletionMessage,
  CompiledTemplate,
  SourceRegistry,
  TaskCtx,
  TaskKind,
} from "./types";

/**
 * Render a compiled template into an array of chat completion messages.
 *
 * This function executes the two-phase rendering process:
 * - Phase A: Fill all slots by executing their plan nodes
 * - Phase B: Assemble the layout by inserting slot content with headers/footers
 *
 * @param template - The compiled template to render
 * @param ctx - Task context providing data for resolution
 * @param budget - Budget manager for tracking token consumption
 * @param registry - Source registry for resolving DataRefs
 * @returns Array of chat completion messages ready for LLM consumption
 * @throws RenderError for unexpected runtime errors during rendering
 */
export function render<K extends TaskKind>(
  template: CompiledTemplate<K>,
  ctx: TaskCtx<K>,
  budget: BudgetManager,
  registry: SourceRegistry<K>
): ChatCompletionMessage[] {
  try {
    // Phase A: Execute all slots to generate message buffers
    const slotBuffers = executeSlots(template.slots, ctx, budget, registry);

    // Phase B: Assemble the final message array using the layout
    return assembleLayout(template.layout, slotBuffers, ctx, budget, registry);
  } catch (error) {
    // If it's already a known error type, re-throw as-is
    if (
      error instanceof TemplateStructureError ||
      error instanceof AuthoringValidationError ||
      error instanceof RenderError
    ) {
      throw error;
    }

    // Wrap unexpected errors in RenderError
    const e = error instanceof Error ? error : new Error(String(error));
    throw new RenderError(
      `Unexpected error during template rendering: ${e.message}`,
      { cause: e }
    );
  }
}
