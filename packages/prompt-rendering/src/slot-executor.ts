import { evaluateCondition } from "./condition-evaluator.js";
import { executePlanNodes } from "./plan-executor.js";
import type {
  BudgetManager,
  CompiledSlotSpec,
  SlotBuffer,
  SourceRegistry,
  SourceSpec,
} from "./types.js";

/**
 * Result of executing slots - map of slot names to their generated messages
 */
export type SlotExecutionResult = Record<string, SlotBuffer>;

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
export function executeSlots<Ctx extends object, S extends SourceSpec>(
  slots: Readonly<Record<string, CompiledSlotSpec<S>>>,
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>
): SlotExecutionResult {
  const result: SlotExecutionResult = {};

  // Sort slots by priority (ascending - 0 before 1 before 2)
  const sortedSlots = Object.entries(slots).sort(([, a], [, b]) => a.priority - b.priority);

  // Execute each slot in priority order
  for (const [slotName, slotSpec] of sortedSlots) {
    // Check if slot should be executed based on condition
    if (slotSpec.when) {
      const shouldExecute = evaluateCondition(slotSpec.when, ctx, registry);
      if (!shouldExecute) {
        result[slotName] = { messages: [], anchors: [] };
        continue;
      }
    }

    // Execute slot under its budget scope if specified
    let slotBuffer: SlotBuffer = { messages: [], anchors: [] };
    budget.withNodeBudget(slotSpec.budget, () => {
      slotBuffer = executePlanNodes(slotSpec.plan, ctx, budget, registry);
    });

    result[slotName] = slotBuffer;
  }

  return result;
}
