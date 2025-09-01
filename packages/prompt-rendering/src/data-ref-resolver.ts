import type { DataRef, SourceRegistry, SourceSpec } from "./types.js";

/**
 * Type guard to check if a value is an array.
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard to check if a value is a non-empty array.
 */
export function isNonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Type guard to check if a value is a string.
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Type guard to check if a value is a valid numeric value (number and not NaN).
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

/**
 * Type guard to check if a value exists (not null or undefined).
 */
export function exists<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard to check if a value is "non-empty" in various contexts:
 * - Arrays: length > 0
 * - Strings: length > 0
 * - Other values: always false
 */
export function isNonEmpty(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.length > 0;
  return false;
}

/**
 * Resolve a DataRef through a SourceRegistry and return the result.
 * Handles undefined/null registry responses gracefully.
 *
 * @param ref The DataRef to resolve
 * @param ctx The task context
 * @param registry The source registry to use for resolution
 * @returns The resolved value, or undefined if resolution fails
 */
export function resolveDataRef<
  Ctx extends object,
  S extends SourceSpec,
  K extends keyof S & string,
>(
  ref: DataRef<K, S[K]["args"]>,
  ctx: Ctx,
  registry: SourceRegistry<Ctx, S>
): S[K]["out"] | undefined {
  try {
    return registry.resolve(ref, ctx);
  } catch (error) {
    // If resolution throws, return undefined rather than propagating
    console.warn(
      `Unresolvable DataRef ${JSON.stringify(ref)} in context with ${Object.keys(ctx).join(", ")} (${error instanceof Error ? error.message : String(error)})`
    );
    return undefined;
  }
}

/**
 * Resolve a DataRef and ensure it returns an array.
 * Non-array results are returned as undefined.
 *
 * @param ref The DataRef to resolve
 * @param ctx The task context
 * @param registry The source registry to use for resolution
 * @returns The resolved array, or undefined if not an array
 */
export function resolveAsArray<
  Ctx extends object,
  S extends SourceSpec,
  K extends keyof S & string,
>(
  ref: DataRef<K, S[K]["args"]>,
  ctx: Ctx,
  registry: SourceRegistry<Ctx, S>
): unknown[] | undefined {
  const result = resolveDataRef(ref, ctx, registry);
  return isArray(result) ? result : undefined;
}

/**
 * Resolve a DataRef and ensure it returns a string.
 * Non-string results are returned as undefined.
 *
 * @param ref The DataRef to resolve
 * @param ctx The task context
 * @param registry The source registry to use for resolution
 * @returns The resolved string, or undefined if not a string
 */
export function resolveAsString<
  Ctx extends object,
  S extends SourceSpec,
  K extends keyof S & string,
>(
  ref: DataRef<K, S[K]["args"]>,
  ctx: Ctx,
  registry: SourceRegistry<Ctx, S>
): string | undefined {
  const result = resolveDataRef(ref, ctx, registry);
  return isString(result) ? result : undefined;
}

/**
 * Resolve a DataRef and ensure it returns a number.
 * Non-number results (including NaN) are returned as undefined.
 *
 * @param ref The DataRef to resolve
 * @param ctx The task context
 * @param registry The source registry to use for resolution
 * @returns The resolved number, or undefined if not a valid number
 */
export function resolveAsNumber<
  Ctx extends object,
  S extends SourceSpec,
  K extends keyof S & string,
>(
  ref: DataRef<K, S[K]["args"]>,
  ctx: Ctx,
  registry: SourceRegistry<Ctx, S>
): number | undefined {
  const result = resolveDataRef(ref, ctx, registry);
  return isValidNumber(result) ? result : undefined;
}
