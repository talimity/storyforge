import type { DataRef, DataRefOf, SourceHandler, SourceRegistry, SourceSpec } from "./types.js";

/**
 * Registry implementation that delegates to a map of source handlers.
 */
class MapBasedRegistry<Ctx, S> implements SourceRegistry<Ctx, S> {
  constructor(
    private readonly handlers: {
      [K in keyof S & string]: SourceHandler<Ctx, S, K>;
    }
  ) {}

  // Overloads to satisfy the SourceRegistry contract
  resolve<K extends keyof S & string>(
    ref: DataRef<K, (S & SourceSpec)[K]["args"]>,
    ctx: Ctx
  ): (S & SourceSpec)[K]["out"] | undefined;
  resolve(ref: DataRefOf<S & SourceSpec>, ctx: Ctx): unknown;
  resolve(ref: DataRef<string, unknown> | DataRefOf<S & SourceSpec>, ctx: Ctx): unknown {
    const handler = this.handlers[(ref as { source: string }).source as keyof S & string];
    return handler ? (handler as unknown as (r: unknown, c: Ctx) => unknown)(ref, ctx) : undefined;
  }

  list(): Array<keyof S & string> {
    return Object.keys(this.handlers) as Array<keyof S & string>;
  }
}

/**
 * Create a SourceRegistry from a map of source names to handler functions.
 *
 * @param handlers Map of source names to functions that resolve DataRefs
 * @returns A SourceRegistry implementation
 *
 * @example
 * ```typescript
 * const registry = makeRegistry<MyCtx, MySourceSpec>({
 *   turns: (ref, ctx) => ctx.turns,
 *   characters: (ref, ctx) => ctx.characters,
 *   intent: (ref, ctx) => ctx.currentIntent,
 * });
 * ```
 */
export function makeRegistry<Ctx, S>(
  handlers: { [K in keyof S & string]: SourceHandler<Ctx, S, K> }
): SourceRegistry<Ctx, S> {
  return new MapBasedRegistry(handlers);
}
