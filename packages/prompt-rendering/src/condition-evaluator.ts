import {
  exists,
  isNonEmpty,
  isValidNumber,
  resolveDataRef,
} from "./data-ref-resolver";
import type { ConditionRef, SourceRegistry, SourceSpec } from "./types";

/**
 * Deep equality check using JSON.stringify for objects and arrays.
 * Falls back to === for primitives.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  // Fast path for primitives and same reference
  if (a === b) return true;

  // Handle null/undefined cases
  if (a == null || b == null) return a === b;

  // For objects and arrays, use JSON comparison
  if (typeof a === "object" || typeof b === "object") {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      // If JSON.stringify fails (circular refs, etc.), fall back to ===
      return a === b;
    }
  }

  return a === b;
}

/**
 * Compare two values for ordering (gt/lt operations).
 * Only works reliably with numbers. Other types return false.
 */
function compareNumbers(a: unknown, b: unknown, op: "gt" | "lt"): boolean {
  if (!isValidNumber(a) || !isValidNumber(b)) {
    return false;
  }

  return op === "gt" ? a > b : a < b;
}

/**
 * Evaluate a condition against a task context using a source registry.
 *
 * @param condition The condition to evaluate
 * @param ctx The task context
 * @param registry The source registry for resolving DataRefs
 * @returns true if the condition passes, false otherwise
 *
 * @example
 * ```typescript
 * const condition: ConditionRef = { type: "exists", ref: { source: "turns" } };
 * const result = evaluateCondition(condition, ctx, registry);
 * ```
 */
export function evaluateCondition<Ctx extends object, S extends SourceSpec>(
  condition: ConditionRef<S>,
  ctx: Ctx,
  registry: SourceRegistry<Ctx, S>
): boolean {
  const { type, ref } = condition;
  const resolvedValue = resolveDataRef(ref, ctx, registry);

  switch (type) {
    case "exists":
      return exists(resolvedValue);

    case "nonEmpty":
      return isNonEmpty(resolvedValue);

    case "eq": {
      const { value } = condition;
      return deepEqual(resolvedValue, value);
    }

    case "neq": {
      const { value } = condition;
      return !deepEqual(resolvedValue, value);
    }

    case "gt": {
      const { value } = condition;
      return compareNumbers(resolvedValue, value, "gt");
    }

    case "lt": {
      const { value } = condition;
      return compareNumbers(resolvedValue, value, "lt");
    }

    default:
      // TypeScript should ensure this never happens, but handle gracefully
      return false;
  }
}
