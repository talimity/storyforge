import { assertNever } from "@storyforge/utils";
import { evaluateCondition } from "./condition-evaluator.js";
import { resolveAsArray, resolveDataRef } from "./data-ref-resolver.js";
import { withAdditionalFrame } from "./scoped-registry.js";
import type {
  BudgetManager,
  ChatCompletionMessage,
  CompiledPlanNode,
  SlotAnchor,
  SourceRegistry,
  SourceSpec,
} from "./types.js";

// Plan nodes emit both messages and logical anchors. Anchors are not rendered
// as messages, but indicate logical positions in the message stream such as
// the boundary of each turn, allowing content to be injected at those points
// later on.
export type PlanExecutionBuffer = {
  messages: ChatCompletionMessage[];
  anchors: SlotAnchor[];
};

function createEmptyBuffer(): PlanExecutionBuffer {
  return { messages: [], anchors: [] };
}

function appendBuffer(target: PlanExecutionBuffer, addition: PlanExecutionBuffer): void {
  if (addition.messages.length === 0 && addition.anchors.length === 0) return;
  const offset = target.messages.length;
  for (const anchor of addition.anchors) {
    // Anchors produced by child nodes are relative to the child buffer; adjust to the caller's length.
    target.anchors.push({ key: anchor.key, index: anchor.index + offset });
  }
  target.messages.push(...addition.messages);
}

function prependBuffer(target: PlanExecutionBuffer, addition: PlanExecutionBuffer): void {
  if (addition.messages.length === 0 && addition.anchors.length === 0) return;
  const { messages, anchors } = target;
  target.messages = [...addition.messages, ...messages];
  const shift = addition.messages.length;
  target.anchors = [
    ...addition.anchors,
    // Anchors already in the target shift forward by however many messages were prepended.
    ...anchors.map((a) => ({ key: a.key, index: a.index + shift })),
  ];
}

/**
 * Scope object for leaf templating that merges context, item, and globals
 */
export type ExecutionScope<Ctx extends CtxWithGlobals> = {
  ctx: Ctx;
  item?: unknown;
  globals?: Record<string, unknown>;
};

export type CtxWithGlobals = { globals?: Record<string, unknown> };

/**
 * Create a merged scope for leaf templating
 */
export function createScope<Ctx extends CtxWithGlobals>(
  ctx: Ctx,
  item?: unknown
): ExecutionScope<Ctx> {
  return { ctx, ...ctx, item };
}

/**
 * Execute a plan node and return the resulting messages.
 * This is the main dispatcher that routes to specific node type executors.
 */
export function executePlanNode<Ctx extends object, S extends SourceSpec>(
  node: CompiledPlanNode<S>,
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>,
  itemScope?: unknown
): PlanExecutionBuffer {
  const nodeKind = node.kind;
  switch (nodeKind) {
    case "message":
      return executeMessageNode(node, ctx, budget, registry, itemScope);
    case "forEach":
      return executeForEachNode(node, ctx, budget, registry, itemScope);
    case "if":
      return executeIfNode(node, ctx, budget, registry, itemScope);
    case "anchor":
      return executeAnchorNode(node, ctx, budget, registry, itemScope);
    default: {
      // Not actually possible to fail here because we check during compilation
      assertNever(nodeKind);
    }
  }
}

/**
 * Execute a message node to produce a single chat message.
 * Resolves `from` via registry or uses literal `content`, applies leaf templating.
 */
export function executeMessageNode<Ctx extends CtxWithGlobals, S extends SourceSpec>(
  node: CompiledPlanNode<S> & { kind: "message" },
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>,
  itemScope?: unknown
): PlanExecutionBuffer {
  // Early exit if no budget is available
  if (!budget.hasAny()) return createEmptyBuffer();

  if (node.when && node.when.length > 0) {
    const allTrue = node.when.every((cond) => evaluateCondition(cond, ctx, registry));
    if (!allTrue) {
      return createEmptyBuffer();
    }
  }

  // Create scope for leaf templating
  const scope = createScope(ctx, itemScope);

  // Determine message content: from DataRef or literal content
  // We do not throw if a DataRef fails to resolve
  let content: string;
  if (node.from) {
    // Resolve from registry
    const resolved = resolveDataRef(node.from, ctx, registry);
    if (resolved == null) {
      return createEmptyBuffer();
    }
    content = typeof resolved === "string" ? resolved : JSON.stringify(resolved);
  } else if (node.content) {
    content = node.content(scope);
  } else {
    // No content source
    return createEmptyBuffer();
  }

  // Apply budget constraints
  if (node.budget) {
    budget.withNodeBudget(node.budget, () => {
      // Node budgets are enforced before consuming the global pool.
      if (!budget.canFitTokenEstimate(content)) {
        content = ""; // Skip if doesn't fit
      } else {
        budget.consume(content);
      }
    });
  } else if (!budget.canFitTokenEstimate(content)) {
    // No more budget available
    return createEmptyBuffer();
  } else {
    budget.consume(content);
  }

  if (!content) {
    return createEmptyBuffer();
  }

  const message: ChatCompletionMessage = { role: node.role, content };
  return { messages: [message], anchors: [] };
}

/**
 * Execute a forEach node to iterate over an array and apply child nodes.
 * Supports ordering, limits, and budget controls.
 */
export function executeForEachNode<Ctx extends object, S extends SourceSpec>(
  node: CompiledPlanNode<S> & { kind: "forEach" },
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>,
  _itemScope?: unknown
): PlanExecutionBuffer {
  // Only check budget at the start if we have a specific node budget
  if (node.budget && !budget.hasAny()) {
    return createEmptyBuffer();
  }

  // Resolve source to array
  const sourceArray = resolveAsArray(node.source, ctx, registry);
  if (!sourceArray || sourceArray.length === 0) {
    return createEmptyBuffer();
  }

  // Apply ordering
  let orderedArray = [...sourceArray];
  if (node.order) {
    switch (node.order) {
      case "asc":
        orderedArray.sort((a, b) => {
          // Simple comparison for basic types
          if (typeof a === "number" && typeof b === "number") {
            return a - b;
          }
          if (typeof a === "string" && typeof b === "string") {
            return a.localeCompare(b);
          }
          // For objects, maintain original order
          return 0;
        });
        break;
      case "desc":
        orderedArray.sort((a, b) => {
          // Simple comparison for basic types
          if (typeof a === "number" && typeof b === "number") {
            return b - a;
          }
          if (typeof a === "string" && typeof b === "string") {
            return b.localeCompare(a);
          }
          // For objects, maintain original order
          return 0;
        });
        break;
    }
  }

  // Apply limit
  if (node.limit && node.limit > 0) {
    orderedArray = orderedArray.slice(0, node.limit);
  }

  const results = createEmptyBuffer();

  // Apply node.budget once for the entire forEach
  budget.withNodeBudget(node.budget, () => {
    for (let i = 0; i < orderedArray.length; i++) {
      const item = orderedArray[i];

      // Check budget before processing
      if (!budget.hasAny()) {
        break;
      }

      // Execute child nodes with item in scope and reserved sources via scoped registry
      const regWithScope = withAdditionalFrame(registry, { item, index: i });
      const nodeResult = createEmptyBuffer();
      for (const childNode of node.map) {
        const childResults = executePlanNode(childNode, ctx, budget, regWithScope, item);
        appendBuffer(nodeResult, childResults);

        // Check budget after each child
        if (!budget.hasAny()) {
          break;
        }
      }

      if (node.fillDir === "prepend") {
        prependBuffer(results, nodeResult);
      } else {
        appendBuffer(results, nodeResult);
      }
    }
  });

  return results;
}

/**
 * Execute an if node to conditionally execute child nodes.
 * Evaluates condition and executes `then` or `else` branch.
 */
export function executeIfNode<Ctx extends object, S extends SourceSpec>(
  node: CompiledPlanNode<S> & { kind: "if" },
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>,
  itemScope?: unknown
): PlanExecutionBuffer {
  // Evaluate the condition
  const conditionResult = evaluateCondition(node.when, ctx, registry);

  // Choose which branch to execute
  const branchNodes = conditionResult ? node.then : node.else;

  if (!branchNodes) {
    return createEmptyBuffer();
  }

  // Execute all nodes in the chosen branch
  return executePlanNodes(branchNodes, ctx, budget, registry, itemScope);
}

/**
 * Execute multiple plan nodes in sequence
 */
export function executePlanNodes<Ctx extends object, S extends SourceSpec>(
  nodes: readonly CompiledPlanNode<S>[],
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>,
  itemScope?: unknown
): PlanExecutionBuffer {
  const results = createEmptyBuffer();

  for (const node of nodes) {
    const nodeResults = executePlanNode(node, ctx, budget, registry, itemScope);
    appendBuffer(results, nodeResults);
  }

  return results;
}

/**
 * Execute an anchor node to produce a logical anchor point. Anchors by
 * themselves are inert and do not consume budget.
 */
export function executeAnchorNode<Ctx extends object, S extends SourceSpec>(
  node: CompiledPlanNode<S> & { kind: "anchor" },
  ctx: Ctx,
  _budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>,
  itemScope?: unknown
): PlanExecutionBuffer {
  if (node.when && node.when.length > 0) {
    const allTrue = node.when.every((cond) => evaluateCondition(cond, ctx, registry));
    if (!allTrue) {
      return createEmptyBuffer();
    }
  }

  const scope = createScope(ctx, itemScope);
  const key = node.key(scope);
  if (!key) {
    return createEmptyBuffer();
  }

  // Anchors return a zero-length buffer whose sole purpose is to record the marker key.
  return { messages: [], anchors: [{ key, index: 0 }] };
}
