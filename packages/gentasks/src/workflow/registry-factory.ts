import type { DataRef, DataRefOf, SourceRegistry, SourceSpec } from "@storyforge/prompt-rendering";
import type {
  ContextFor,
  RunnerModelContext,
  RuntimeSourceSpec,
  SourcesFor,
  TaskKind,
  TaskSourcesMap,
} from "../types.js";

/**
 * Extends a task context with runtime-provided fields (step outputs + model metadata).
 */
export type ExtendedContext<Ctx> = Ctx & {
  stepOutputs: Record<string, unknown>;
  model?: RunnerModelContext;
};

/**
 * Creates an extended registry that wraps the base registry and resolves
 * runtime sources (currently `stepOutput`).
 */
export function createExtendedRegistry<K extends TaskKind>(
  baseRegistry: SourceRegistry<ContextFor<K>, TaskSourcesMap[K]>
): SourceRegistry<ExtendedContext<ContextFor<K>>, SourcesFor<K> & SourceSpec> {
  function resolve(
    ref: Parameters<
      SourceRegistry<ExtendedContext<ContextFor<K>>, SourcesFor<K> & SourceSpec>["resolve"]
    >[0],
    ctx: ExtendedContext<ContextFor<K>>
  ): unknown {
    if (isStepOutputRef(ref)) {
      const key = (ref.args as RuntimeSourceSpec["stepOutput"]["args"] | undefined)?.key;
      return key ? ctx.stepOutputs[key] : undefined;
    }
    return baseRegistry.resolve(
      ref as DataRefOf<TaskSourcesMap[K] & SourceSpec>,
      ctx as ContextFor<K>
    );
  }

  const list: SourceRegistry<ExtendedContext<ContextFor<K>>, SourcesFor<K> & SourceSpec>["list"] =
    () => {
      const baseList = baseRegistry.list?.bind(baseRegistry) as (() => string[]) | undefined;
      const base = baseList ? baseList() : [];
      if (base.includes("stepOutput")) {
        return base as Array<keyof (SourcesFor<K> & SourceSpec) & string>;
      }
      return [...base, "stepOutput"] as Array<keyof (SourcesFor<K> & SourceSpec) & string>;
    };

  return { resolve, list } as SourceRegistry<
    ExtendedContext<ContextFor<K>>,
    SourcesFor<K> & SourceSpec
  >;
}

function hasStepOutputs<Ctx extends object>(
  ctx: Ctx | ExtendedContext<Ctx>
): ctx is ExtendedContext<Ctx> {
  return "stepOutputs" in ctx && typeof (ctx as ExtendedContext<Ctx>).stepOutputs === "object";
}

/**
 * Ensure a context has runtime augmentation at render time.
 */
export function ensureExtendedContext<Ctx extends object>(
  ctx: Ctx,
  stepOutputs: Record<string, unknown>
): ExtendedContext<Ctx> {
  if (hasStepOutputs(ctx)) {
    return { ...ctx, stepOutputs };
  }
  return { ...ctx, stepOutputs };
}

function isStepOutputRef<_K extends TaskKind>(
  ref: DataRef<string, unknown>
): ref is DataRef<"stepOutput", RuntimeSourceSpec["stepOutput"]["args"]> {
  return (ref as { source?: string }).source === "stepOutput";
}
