import { AuthoringValidationError, RenderError, TemplateStructureError } from "./errors.js";
import { assembleLayout } from "./layout-assembler.js";
import { makeScopedRegistry } from "./scoped-registry.js";
import { executeSlots } from "./slot-executor.js";
import type {
  BudgetManager,
  ChatCompletionMessage,
  CompiledTemplate,
  SourceRegistry,
  SourceSpec,
} from "./types.js";

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
export function render<K extends string, Ctx extends object, S extends SourceSpec>(
  template: CompiledTemplate<K, S>,
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>
): ChatCompletionMessage[] {
  try {
    const reg = makeScopedRegistry(registry, { frames: [] });
    // Phase A: Execute all slots to generate message buffers
    const slotBuffers = executeSlots(template.slots, ctx, budget, reg);

    // Phase B: Assemble the final message array using the layout
    const layout = assembleLayout(template.layout, slotBuffers, ctx, budget, reg);

    // Post process by squashing consecutive messages with the same role
    // TODO: Make this use a configurable delimeter
    const messages: ChatCompletionMessage[] = [];
    for (const msg of layout) {
      const last = messages[messages.length - 1];
      if (last && last.role === msg.role) last.content += `\n${msg.content}`;
      else messages.push(msg);
    }
    return messages;
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
    throw new RenderError(`Unexpected error during template rendering: ${e.message}`, { cause: e });
  }
}
