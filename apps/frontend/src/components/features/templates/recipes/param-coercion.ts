/**
 * Shared parameter coercion utilities for recipe implementations
 * These provide type-safe parameter handling with sensible defaults
 */

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
  const n = typeof v === "number" ? v : Number(v ?? def);
  const num = Number.isFinite(n) ? n : def;
  return Math.max(min ?? -Infinity, Math.min(max ?? Infinity, num));
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
