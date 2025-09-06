/**
 * Shared parameter coercion utilities for recipe implementations
 */

import type {
  InferRecipeParams,
  RecipeParamSpec,
} from "@/features/template-builder/types";

/**
 * Coerce order parameter to valid sort order
 */
export function coerceOrder(
  v: unknown,
  defaultOrder: "asc" | "desc" = "desc"
): "asc" | "desc" {
  return v === "asc" || v === "desc" ? v : defaultOrder;
}

/**
 * Coerce number parameter with optional min/max clamping
 */
export function coerceNumber(
  v: unknown,
  def: number,
  min?: number,
  max?: number
) {
  let n: number;
  if (typeof v === "number") n = v;
  else if (v === "" || v === null || v === undefined) n = def;
  else {
    const parsed = Number(v);
    n = Number.isFinite(parsed) ? parsed : def;
  }
  return Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n));
}

/**
 * Coerce string parameter with fallback default
 */
export function coerceString(v: unknown, defaultValue: string): string {
  return typeof v === "string" ? v : defaultValue;
}

/**
 * Coerce boolean parameter with fallback default
 */
export function coerceBoolean(v: unknown, defaultValue: boolean): boolean {
  return typeof v === "boolean" ? v : defaultValue;
}

/**
 * Auto-coerce all recipe parameters based on their parameter definitions.
 * This ensures that parameters are properly typed and validated according
 * to the constraints specified in the recipe's parameter definitions.
 */
export function coerceRecipeParams<P extends readonly RecipeParamSpec[]>(
  paramSpecs: P,
  rawParams: Record<string, unknown>
): InferRecipeParams<P> {
  const out: Record<string, unknown> = {};

  for (const spec of paramSpecs) {
    const rawValue = rawParams[spec.key];
    const defaultValue = spec.defaultValue;

    switch (spec.type) {
      case "number":
        out[spec.key] = coerceNumber(
          rawValue,
          (defaultValue as number) ?? 0,
          spec.min,
          spec.max
        );
        break;

      case "template_string":
        out[spec.key] = coerceString(rawValue, (defaultValue as string) ?? "");
        break;

      case "select": {
        const val = coerceString(rawValue, (defaultValue as string) ?? "");
        const allowed = spec.options?.map((o) => o.value);
        out[spec.key] = allowed?.length
          ? allowed.includes(val)
            ? val
            : ((defaultValue as string) ?? String(allowed[0]))
          : val;
        break;
      }

      case "toggle":
        out[spec.key] = coerceBoolean(
          rawValue,
          (defaultValue as boolean) ?? false
        );
        break;

      default:
        // Fallback: pass through the default value or raw value
        out[spec.key] = rawValue ?? defaultValue;
    }
  }

  return out as InferRecipeParams<P>;
}
