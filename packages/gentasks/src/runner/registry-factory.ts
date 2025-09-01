import type { SourceRegistry } from "@storyforge/prompt-rendering";
import type { ContextFor, SourcesFor, TaskKind } from "../types";

/**
 * Extends a task context with `stepInputs` so it can be used in source handlers
 * that need access to inputs from previous steps.
 */
export type ExtendedContext<Ctx> = Ctx & {
  stepInputs: Record<string, unknown>;
};

/**
 * Creates an extended registry that wraps the base registry and adds stepInputs
 * to the context.
 */
export function createExtendedRegistry<K extends TaskKind>(
  baseRegistry: SourceRegistry<ContextFor<K>, SourcesFor<K>>
): SourceRegistry<ExtendedContext<ContextFor<K>>, SourcesFor<K>> {
  return {
    resolve(ref, ctx) {
      return baseRegistry.resolve(ref, ctx);
    },
    list() {
      return baseRegistry.list?.() || [];
    },
  };
}

function hasStepInputs<Ctx extends object>(
  ctx: Ctx | ExtendedContext<Ctx>
): ctx is ExtendedContext<Ctx> {
  return "stepInputs" in ctx && typeof ctx.stepInputs === "object";
}

/**
 * Ensure a context has stepInputs property
 */
export function ensureExtendedContext<Ctx extends object>(
  ctx: Ctx
): ExtendedContext<Ctx> {
  if (hasStepInputs(ctx)) {
    return ctx;
  }
  return { ...ctx, stepInputs: {} };
}
