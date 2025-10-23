import { assertNever } from "@storyforge/utils";
import { evaluateCondition } from "./condition-evaluator.js";
import { resolveDataRef } from "./data-ref-resolver.js";
import { TemplateStructureError } from "./errors.js";
import { createScope } from "./plan-executor.js";
import type { SlotExecutionResult } from "./slot-executor.js";
import type {
  BudgetManager,
  ChatCompletionMessage,
  CompiledLayoutNode,
  CompiledMessageBlock,
  CompiledSlotFrameAnchor,
  CompiledSlotFrameNode,
  GlobalAnchor,
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
export type PreparedBlock = {
  role: ChatCompletionMessage["role"];
  content: string;
  tokens: number;
  shouldEmit: boolean;
};

export type PreparedFrameNode =
  | { kind: "message"; block: PreparedBlock }
  | { kind: "anchor"; key?: string };

export type PreparedSlotBlocks = {
  header?: PreparedFrameNode[];
  footer?: PreparedFrameNode[];
};

export type PreparedLayoutNode =
  | { kind: "message"; block: PreparedBlock }
  | {
      kind: "slot";
      name: string;
      omitIfEmpty?: boolean;
      blocks: PreparedSlotBlocks;
    }
  | { kind: "anchor"; key?: string };

export type PreparedLayout = {
  nodes: readonly PreparedLayoutNode[];
  floor: number;
};

export type LayoutAssemblyResult = {
  messages: ChatCompletionMessage[];
  anchors: GlobalAnchor[];
};

/**
 * Prepare the layout by pre-evaluating static messages and reserving budget for
 * slot wrappers.
 */
export function prepareLayout<Ctx extends object, S extends SourceSpec>(
  layout: readonly CompiledLayoutNode<S>[],
  ctx: Ctx,
  registry: SourceRegistry<Ctx, S>,
  budget: BudgetManager
): PreparedLayout {
  const nodes: PreparedLayoutNode[] = [];
  let floor = 0;
  const scope = createScope(ctx);

  for (const node of layout) {
    switch (node.kind) {
      case "message": {
        // Pre-render literal layout messages so we can reserve their token cost before slots run.
        const block = prepareBlock(node, ctx, scope, registry, budget);
        if (block.shouldEmit) floor += block.tokens;
        nodes.push({ kind: "message", block });
        break;
      }
      case "slot": {
        // Slot headers/footers are rendered up front so their token usage contributes to the layout floor.
        const header = prepareFrameNodes(node.header, ctx, scope, registry, budget);
        const footer = prepareFrameNodes(node.footer, ctx, scope, registry, budget);
        for (const collection of [header, footer]) {
          if (!collection) continue;
          for (const entry of collection) {
            if (entry.kind === "message" && entry.block.shouldEmit) {
              floor += entry.block.tokens;
            }
          }
        }
        nodes.push({
          kind: "slot",
          name: node.name,
          omitIfEmpty: node.omitIfEmpty,
          blocks: { header, footer },
        });
        break;
      }
      case "anchor": {
        if (node.when && node.when.length > 0) {
          const allTrue = node.when.every((cond) => evaluateCondition(cond, ctx, registry));
          if (!allTrue) {
            nodes.push({ kind: "anchor" });
            continue;
          }
        }
        // Anchors capture named positions in the prepared layout without consuming budget.
        const key = node.key(scope);
        nodes.push({ kind: "anchor", key: key || undefined });
        break;
      }
      default:
        assertNever(node);
    }
  }

  return { nodes, floor };
}

export function assembleLayout(
  prepared: PreparedLayout,
  slotBuffers: SlotExecutionResult,
  budget: BudgetManager
): LayoutAssemblyResult {
  const messages: ChatCompletionMessage[] = [];
  const anchors: GlobalAnchor[] = [];

  for (const node of prepared.nodes) {
    if (node.kind === "message") {
      emitPreparedBlock(node.block, budget, messages);
      continue;
    }
    if (node.kind === "slot") {
      processPreparedSlot(node, slotBuffers, budget, messages, anchors);
      continue;
    }
    // Anchors in the layout map directly to message indices so injections can target them later.
    if (node.key) {
      anchors.push({ key: node.key, index: messages.length, source: "layout" });
    }
  }

  return { messages, anchors };
}

function processPreparedSlot(
  node: Extract<PreparedLayoutNode, { kind: "slot" }>,
  slotBuffers: SlotExecutionResult,
  budget: BudgetManager,
  messages: ChatCompletionMessage[],
  anchors: GlobalAnchor[]
): void {
  const buffer = slotBuffers[node.name];
  if (!buffer) {
    throw new TemplateStructureError(`Layout references nonexistent slot '${node.name}'`);
  }

  const hasMessages = buffer.messages.length > 0;
  const shouldInclude = hasMessages || node.omitIfEmpty === false;

  const emitCollection = (
    collection: PreparedFrameNode[] | undefined,
    shouldEmit: boolean
  ): void => {
    if (!collection) return;
    for (const entry of collection) {
      if (entry.kind === "anchor") {
        if (!shouldEmit) continue;
        if (!entry.key) continue;
        anchors.push({
          key: entry.key,
          index: messages.length,
          source: "layout",
          slotName: node.name,
        });
        continue;
      }

      const block = entry.block;
      if (!block.shouldEmit) continue;
      if (!shouldEmit) {
        // Slot produced no content; release any reserved layout budget for these wrapper blocks.
        budget.releaseFloor("layout", block.tokens);
        continue;
      }
      const emitted = emitPreparedBlock(block, budget, messages);
      if (!emitted) {
        budget.releaseFloor("layout", block.tokens);
      }
    }
  };

  emitCollection(node.blocks.header, shouldInclude);

  if (hasMessages) {
    const baseIndex = messages.length;
    for (const anchor of buffer.anchors) {
      anchors.push({
        key: anchor.key,
        index: baseIndex + anchor.index,
        source: "slot",
        slotName: node.name,
      });
    }
    messages.push(...buffer.messages);
  }

  emitCollection(node.blocks.footer, shouldInclude);
}

function emitPreparedBlock(
  block: PreparedBlock,
  budget: BudgetManager,
  messages: ChatCompletionMessage[]
): boolean {
  if (!block.shouldEmit) return false;
  let emitted = false;
  budget.withLane("layout", () => {
    // If the block cannot fit, we skip it rather than forcing the layout to exceed its reservation.
    if (!budget.canFitTokenEstimate(block.content)) return;
    budget.consume(block.content);
    messages.push({ role: block.role, content: block.content });
    emitted = true;
  });
  if (!emitted) {
    budget.releaseFloor("layout", block.tokens);
  }
  return emitted;
}

function isCompiledSlotFrameAnchor<S extends SourceSpec>(
  node: CompiledSlotFrameNode<S>
): node is CompiledSlotFrameAnchor<S> {
  return (node as CompiledSlotFrameAnchor<S>).kind === "anchor";
}

function prepareFrameNodes<Ctx extends object, S extends SourceSpec>(
  nodes: readonly CompiledSlotFrameNode<S>[] | undefined,
  ctx: Ctx,
  scope: ReturnType<typeof createScope<Ctx>>,
  registry: SourceRegistry<Ctx, S>,
  budget: BudgetManager
): PreparedFrameNode[] | undefined {
  if (!nodes) return undefined;
  const prepared: PreparedFrameNode[] = [];

  for (const node of nodes) {
    if (isCompiledSlotFrameAnchor(node)) {
      if (node.when && node.when.length > 0) {
        const allTrue = node.when.every((cond) => evaluateCondition(cond, ctx, registry));
        if (!allTrue) {
          prepared.push({ kind: "anchor" });
          continue;
        }
      }
      const key = node.key(scope);
      prepared.push({ kind: "anchor", key: key || undefined });
      continue;
    }

    const block = prepareBlock(node, ctx, scope, registry, budget);
    prepared.push({ kind: "message", block });
  }

  return prepared;
}

function prepareBlock<Ctx extends object, S extends SourceSpec>(
  block: CompiledMessageBlock<S>,
  ctx: Ctx,
  scope: ReturnType<typeof createScope<Ctx>>,
  registry: SourceRegistry<Ctx, S>,
  budget: BudgetManager
): PreparedBlock {
  if (block.when && block.when.length > 0) {
    const allTrue = block.when.every((cond) => evaluateCondition(cond, ctx, registry));
    if (!allTrue) {
      return { role: block.role, content: "", tokens: 0, shouldEmit: false };
    }
  }

  let content: string | undefined;
  if (block.from) {
    const resolved = resolveDataRef(block.from, ctx, registry);
    if (resolved == null) {
      return { role: block.role, content: "", tokens: 0, shouldEmit: false };
    }
    content = typeof resolved === "string" ? resolved : JSON.stringify(resolved);
  } else if (block.content) {
    content = block.content(scope);
  }

  if (!content) {
    return { role: block.role, content: "", tokens: 0, shouldEmit: false };
  }

  const tokens = budget.estimateTokens(content);
  return { role: block.role, content, tokens, shouldEmit: true };
}
