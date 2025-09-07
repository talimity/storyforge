import type { DataRef, SourceHandler, SourceRegistry, SourceSpec } from "./types.js";

/**
 * Registry implementation that delegates to a map of source handlers.
 */
class MapBasedRegistry<Ctx, S extends SourceSpec> implements SourceRegistry<Ctx, S> {
  constructor(
    private readonly handlers: {
      [K in keyof S & string]: SourceHandler<Ctx, S, K>;
    }
  ) {}

  resolve<K extends keyof S & string>(
    ref: DataRef<K, S[K]["args"]>,
    ctx: Ctx
  ): S[K]["out"] | undefined {
    const handler = this.handlers[ref.source];
    return handler ? handler(ref, ctx) : undefined;
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
export function makeRegistry<Ctx, S extends SourceSpec>(
  handlers: { [K in keyof S & string]: SourceHandler<Ctx, S, K> }
): SourceRegistry<Ctx, S> {
  return new MapBasedRegistry(handlers);
}
