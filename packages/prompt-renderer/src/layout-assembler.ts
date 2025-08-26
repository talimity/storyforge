import { resolveDataRef } from "./data-ref-resolver";
import { TemplateStructureError } from "./errors";
import { createScope } from "./plan-executor";
import type { SlotExecutionResult } from "./slot-executor";
import type {
  BudgetManager,
  ChatCompletionMessage,
  ChatCompletionMessageRole,
  CompiledLayoutNode,
  CompiledLeafFunction,
  CompiledMessageBlock,
  DataRef,
  SourceRegistry,
  TaskCtx,
  TaskKind,
} from "./types";

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
export function assembleLayout<K extends TaskKind>(
  layout: readonly CompiledLayoutNode[],
  slotBuffers: SlotExecutionResult,
  ctx: TaskCtx<K>,
  budget: BudgetManager,
  registry: SourceRegistry<K>
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
      case "separator":
        processSeparatorNode(node, ctx, budget, result);
        break;
      default: {
        const badNode = nodeKind satisfies never;
        console.warn(
          `prompt-renderer assembler: Unsupported LayoutNode '${badNode}'.`
        );
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
function emitBlock<K extends TaskKind>(
  block: {
    role: ChatCompletionMessageRole;
    content?: CompiledLeafFunction;
    from?: DataRef;
    prefix?: boolean;
  },
  ctx: TaskCtx<K>,
  budget: BudgetManager,
  registry: SourceRegistry<K>,
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
    content =
      typeof resolved === "string" ? resolved : JSON.stringify(resolved);
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
function processMessageNode<K extends TaskKind>(
  node: CompiledLayoutNode & { kind: "message" },
  ctx: TaskCtx<K>,
  budget: BudgetManager,
  registry: SourceRegistry<K>,
  result: ChatCompletionMessage[]
): void {
  emitBlock(node, ctx, budget, registry, result);
}

/**
 * Process a slot node in the layout.
 * Inserts slot buffer content with optional headers and footers.
 * Slot content is NOT re-budget-checked (already done in Phase A).
 */
function processSlotNode<K extends TaskKind>(
  node: CompiledLayoutNode & { kind: "slot" },
  slotBuffers: SlotExecutionResult,
  ctx: TaskCtx<K>,
  budget: BudgetManager,
  registry: SourceRegistry<K>,
  result: ChatCompletionMessage[]
): void {
  // Check if slot exists in buffers
  if (!(node.name in slotBuffers)) {
    throw new TemplateStructureError(
      `Layout references nonexistent slot '${node.name}'`
    );
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
 * Process a separator node in the layout.
 * Emits as a user message with the separator text.
 */
function processSeparatorNode<K extends TaskKind>(
  node: CompiledLayoutNode & { kind: "separator" },
  ctx: TaskCtx<K>,
  budget: BudgetManager,
  result: ChatCompletionMessage[]
): void {
  // Early exit if no budget
  if (!budget.hasAny()) return;

  // Get separator text
  const scope = createScope(ctx);
  const content = node.text ? node.text(scope) : "";

  // Skip empty separators
  if (!content) return;

  // Apply budget check
  if (!budget.canFitTokenEstimate(content)) return;

  // Consume budget and emit separator as user message
  budget.consume(content);

  result.push({ role: "user", content });
}

/**
 * Process message blocks (headers/footers) with budget checking.
 * These are always budget-checked in Phase B.
 */
function processMessageBlocks<K extends TaskKind>(
  blocks: readonly CompiledMessageBlock[],
  ctx: TaskCtx<K>,
  budget: BudgetManager,
  registry: SourceRegistry<K>,
  result: ChatCompletionMessage[]
): void {
  for (const block of blocks) {
    const emitResult = emitBlock(block, ctx, budget, registry, result);
    if (emitResult === "stop") break;
    // Continue on 'skip' or 'emitted'
  }
}
