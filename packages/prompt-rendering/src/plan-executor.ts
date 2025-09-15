import { evaluateCondition } from "./condition-evaluator.js";
import { resolveAsArray, resolveDataRef } from "./data-ref-resolver.js";
import { withAdditionalFrame } from "./scoped-registry.js";
import type {
  BudgetManager,
  ChatCompletionMessage,
  CompiledPlanNode,
  SourceRegistry,
  SourceSpec,
} from "./types.js";

/**
 * Execution result for plan nodes - array of messages to be included in output
 */
export type PlanExecutionResult = ChatCompletionMessage[];

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
): PlanExecutionResult {
  const nodeKind = node.kind;
  switch (nodeKind) {
    case "message":
      return executeMessageNode(node, ctx, budget, registry, itemScope);
    case "forEach":
      return executeForEachNode(node, ctx, budget, registry, itemScope);
    case "if":
      return executeIfNode(node, ctx, budget, registry, itemScope);
    default: {
      // TypeScript should prevent this, but handle gracefully
      const _badKind = nodeKind satisfies never;
      console.warn(`prompt-rendering executor: Unsupported PlanNode '${_badKind}'.`);
      return [];
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
): PlanExecutionResult {
  // Early exit if no budget is available
  if (!budget.hasAny()) return [];

  // Create scope for leaf templating
  const scope = createScope(ctx, itemScope);

  // Determine message content: from DataRef or literal content
  let content: string;
  if (node.from) {
    // Resolve from registry
    const resolved = resolveDataRef(node.from, ctx, registry);
    if (resolved == null) {
      return []; // emit nothing per spec
    }
    content = typeof resolved === "string" ? resolved : JSON.stringify(resolved);
  } else if (node.content) {
    // Use compiled leaf function
    content = node.content(scope);
  } else {
    // No content source
    return []; // no source → no emission
  }

  // Apply budget constraints
  if (node.budget) {
    budget.withNodeBudget(node.budget, () => {
      if (!budget.canFitTokenEstimate(content)) {
        content = ""; // Skip if doesn't fit
      } else {
        budget.consume(content);
      }
    });
  } else if (!budget.canFitTokenEstimate(content)) {
    return []; // Skip if doesn't fit global budget
  } else {
    budget.consume(content);
  }

  // Skip empty messages
  if (!content) {
    return [];
  }

  // Create the message, preserving prefix flag
  const message: ChatCompletionMessage = {
    role: node.role,
    content,
  };

  if (node.prefix) {
    message.prefix = true;
  }

  return [message];
}

/**
 * Execute a forEach node to iterate over an array and apply child nodes.
 * Supports ordering, limits, interleaving, and budget controls.
 */
export function executeForEachNode<Ctx extends object, S extends SourceSpec>(
  node: CompiledPlanNode<S> & { kind: "forEach" },
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>,
  _itemScope?: unknown
): PlanExecutionResult {
  // Only check budget at the start if we have a specific node budget
  // If stopWhenOutOfBudget is false, we should always try to process
  const stopWhenOutOfBudget = node.stopWhenOutOfBudget ?? true;
  if (node.budget && stopWhenOutOfBudget && !budget.hasAny()) {
    return [];
  }

  // Resolve source to array
  const sourceArray = resolveAsArray(node.source, ctx, registry);
  if (!sourceArray || sourceArray.length === 0) {
    return [];
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

  const results: ChatCompletionMessage[] = [];

  // Apply node.budget once for the entire forEach
  budget.withNodeBudget(node.budget, () => {
    for (let i = 0; i < orderedArray.length; i++) {
      const item = orderedArray[i];

      // Check budget before processing
      if (stopWhenOutOfBudget && !budget.hasAny()) {
        break;
      }

      // Execute child nodes with item in scope and reserved sources via scoped registry
      const regWithScope = withAdditionalFrame(registry, { item, index: i });
      for (const childNode of node.map) {
        const childResults = executePlanNode(childNode, ctx, budget, regWithScope, item);
        results.push(...childResults);

        // Check budget after each child
        if (stopWhenOutOfBudget && !budget.hasAny()) {
          break;
        }
      }

      // Add separator if specified and not the last item
      if (node.interleave && i < orderedArray.length - 1) {
        const separatorText = node.interleave.text
          ? node.interleave.text(createScope(ctx, item))
          : "";

        if (separatorText && budget.canFitTokenEstimate(separatorText)) {
          budget.consume(separatorText);
          results.push({
            role: "user", // Separators are user messages per spec
            content: separatorText,
          });
        }
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
): PlanExecutionResult {
  // Evaluate the condition
  const conditionResult = evaluateCondition(node.when, ctx, registry);

  // Choose which branch to execute
  const branchNodes = conditionResult ? node.then : node.else;

  if (!branchNodes) {
    return [];
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
): PlanExecutionResult {
  const results: ChatCompletionMessage[] = [];

  for (const node of nodes) {
    const nodeResults = executePlanNode(node, ctx, budget, registry, itemScope);
    results.push(...nodeResults);
  }

  return results;
}
