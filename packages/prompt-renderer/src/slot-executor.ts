import { evaluateCondition } from "./condition-evaluator";
import { executePlanNodes } from "./plan-executor";
import type {
  BudgetManager,
  ChatCompletionMessage,
  CompiledSlotSpec,
  SourceRegistry,
  TaskCtx,
  TaskKind,
} from "./types";

/**
 * Result of executing slots - map of slot names to their generated messages
 */
export type SlotExecutionResult = Record<string, ChatCompletionMessage[]>;

/**
 * Execute all slots in priority order with budget management.
 * Slots are executed in ascending priority order (0 before 1).
 * Each slot runs under its own budget scope if specified.
 *
 * @param slots - Map of slot names to compiled slot specifications
 * @param ctx - Task context for execution
 * @param budget - Budget manager for tracking token usage
 * @param registry - Source registry for resolving DataRefs
 * @returns Map of slot names to their generated messages
 */
export function executeSlots<K extends TaskKind>(
  slots: Readonly<Record<string, CompiledSlotSpec>>,
  ctx: TaskCtx<K>,
  budget: BudgetManager,
  registry: SourceRegistry<K>
): SlotExecutionResult {
  const result: SlotExecutionResult = {};

  // Sort slots by priority (ascending - 0 before 1 before 2)
  const sortedSlots = Object.entries(slots).sort(
    ([, a], [, b]) => a.priority - b.priority
  );

  // Execute each slot in priority order
  for (const [slotName, slotSpec] of sortedSlots) {
    // Check if slot should be executed based on condition
    if (slotSpec.when) {
      const shouldExecute = evaluateCondition(slotSpec.when, ctx, registry);
      if (!shouldExecute) {
        result[slotName] = [];
        continue;
      }
    }

    // Execute slot under its budget scope if specified
    let slotMessages: ChatCompletionMessage[] = [];
    budget.withNodeBudget(slotSpec.budget, () => {
      slotMessages = executePlanNodes(slotSpec.plan, ctx, budget, registry);
    });

    result[slotName] = slotMessages;
  }

  return result;
}
