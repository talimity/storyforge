import { resolveDataRef } from "./data-ref-resolver.js";
import { TemplateStructureError } from "./errors.js";
import { type CtxWithGlobals, createScope } from "./plan-executor.js";
import type { SlotExecutionResult } from "./slot-executor.js";
import type {
  BudgetManager,
  ChatCompletionMessage,
  ChatCompletionMessageRole,
  CompiledLayoutNode,
  CompiledLeafFunction,
  CompiledMessageBlock,
  DataRefOf,
  SourceRegistry,
  SourceSpec,
} from "./types.js";

/**
 * Phase B: Assemble the final message array by walking the layout structure
 * and inserting slot buffers with optional headers/footers.
 *
 * This function:
 * - Processes layout nodes in order
 * - Inserts pre-filled slot content (budgeted beforehand in Phase A)
 * - Applies budget checking to headers, footers, messages, and separators
 * - Handles omitIfEmpty logic for slots
 * - Throws on missing slot references
 */
export function assembleLayout<Ctx extends object, S extends SourceSpec>(
  layout: readonly CompiledLayoutNode<S>[],
  slotBuffers: SlotExecutionResult,
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>
): ChatCompletionMessage[] {
  const result: ChatCompletionMessage[] = [];

  for (const node of layout) {
    const nodeKind = node.kind;
    switch (nodeKind) {
      case "message":
        processMessageNode(node, ctx, budget, registry, result);
        break;
      case "slot":
        processSlotNode(node, slotBuffers, ctx, budget, registry, result);
        break;
      default: {
        const badNode = nodeKind satisfies never;
        console.warn(`prompt-rendering assembler: Unsupported LayoutNode '${badNode}'.`);
      }
    }
  }

  return result;
}

/**
 * Result of attempting to emit a block
 */
type EmitBlockResult = "emitted" | "skip" | "stop";

/**
 * Helper function to emit a message block with budget checking.
 * Handles the common pattern: resolve content → budget check → emit message.
 */
function emitBlock<Ctx extends CtxWithGlobals, S extends SourceSpec>(
  block: {
    role: ChatCompletionMessageRole;
    content?: CompiledLeafFunction;
    from?: DataRefOf<S>;
    prefix?: boolean;
  },
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>,
  result: ChatCompletionMessage[]
): EmitBlockResult {
  // Early exit if no budget
  if (!budget.hasAny()) return "stop";

  // Create scope for leaf templating
  const scope = createScope(ctx);

  // Determine message content: from DataRef or literal content
  let content: string;
  if (block.from) {
    // Resolve from registry
    const resolved = resolveDataRef(block.from, ctx, registry);
    if (resolved == null) {
      return "skip"; // skip this block
    }
    content = typeof resolved === "string" ? resolved : JSON.stringify(resolved);
  } else if (block.content) {
    // Use compiled leaf function
    content = block.content(scope);
  } else {
    // No content source
    return "skip"; // skip this block
  }

  // Apply budget check
  if (!budget.canFitTokenEstimate(content)) {
    return "stop"; // Stop processing if budget exhausted
  }

  // Skip empty messages
  if (!content) {
    return "skip";
  }

  // Consume budget and emit message
  budget.consume(content);

  const message: ChatCompletionMessage = {
    role: block.role,
    content,
  };

  if (block.prefix) {
    message.prefix = true;
  }

  result.push(message);
  return "emitted";
}

/**
 * Process a message node in the layout.
 * Resolves content from DataRef or uses literal content, applies budget checking.
 */
function processMessageNode<Ctx extends object, S extends SourceSpec>(
  node: CompiledLayoutNode<S> & { kind: "message" },
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>,
  result: ChatCompletionMessage[]
): void {
  emitBlock(node, ctx, budget, registry, result);
}

/**
 * Process a slot node in the layout.
 * Inserts slot buffer content with optional headers and footers.
 * Slot content is NOT re-budget-checked (already done in Phase A).
 */
function processSlotNode<Ctx extends object, S extends SourceSpec>(
  node: CompiledLayoutNode<S> & { kind: "slot" },
  slotBuffers: SlotExecutionResult,
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>,
  result: ChatCompletionMessage[]
): void {
  // Check if slot exists in buffers
  if (!(node.name in slotBuffers)) {
    throw new TemplateStructureError(`Layout references nonexistent slot '${node.name}'`);
  }

  const slotMessages = slotBuffers[node.name];
  const hasMessages = slotMessages && slotMessages.length > 0;

  // Handle omitIfEmpty logic
  if (!hasMessages && node.omitIfEmpty !== false) {
    return; // Skip entirely if empty and omitIfEmpty is true (default)
  }

  // Emit headers if present and we have messages or omitIfEmpty is false
  if (node.header && (hasMessages || node.omitIfEmpty === false)) {
    processMessageBlocks(node.header, ctx, budget, registry, result);
  }

  // Emit slot content (NOT re-budget-checked)
  if (hasMessages) {
    result.push(...slotMessages);
  }

  // Emit footers if present and we have messages or omitIfEmpty is false
  if (node.footer && (hasMessages || node.omitIfEmpty === false)) {
    processMessageBlocks(node.footer, ctx, budget, registry, result);
  }
}

/**
 * Process message blocks (headers/footers) with budget checking.
 * These are always budget-checked in Phase B.
 */
function processMessageBlocks<Ctx extends object, S extends SourceSpec>(
  blocks: readonly CompiledMessageBlock<S>[],
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>,
  result: ChatCompletionMessage[]
): void {
  for (const block of blocks) {
    const emitResult = emitBlock(block, ctx, budget, registry, result);
    if (emitResult === "stop") break;
    // Continue on 'skip' or 'emitted'
  }
}
