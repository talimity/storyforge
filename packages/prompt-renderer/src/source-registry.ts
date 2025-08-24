import type { DataRef, SourceRegistry, TaskCtx, TaskKind } from "./types";

/**
 * Source handler function type - receives a DataRef and task context,
 * returns any value that the source provides.
 */
export type SourceHandler<K extends TaskKind> = (
  ref: DataRef,
  ctx: TaskCtx<K>
) => unknown;

/**
 * Registry implementation that delegates to a map of source handlers.
 */
class MapBasedRegistry<K extends TaskKind> implements SourceRegistry<K> {
  constructor(private readonly handlers: Record<string, SourceHandler<K>>) {}

  resolve(ref: DataRef, ctx: TaskCtx<K>): unknown {
    const handler = this.handlers[ref.source];
    if (!handler) {
      return undefined;
    }
    return handler(ref, ctx);
  }

  list(): string[] {
    return Object.keys(this.handlers);
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
 * const registry = makeRegistry({
 *   turns: (ref, ctx) => ctx.turns,
 *   characters: (ref, ctx) => ctx.characters,
 *   intent: (ref, ctx) => ctx.currentIntent,
 * });
 * ```
 */
export function makeRegistry<K extends TaskKind>(
  handlers: Record<string, SourceHandler<K>>
): SourceRegistry<K> {
  return new MapBasedRegistry(handlers);
}
