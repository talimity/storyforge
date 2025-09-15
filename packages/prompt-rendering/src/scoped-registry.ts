import { resolvePath } from "./path-resolver.js";
import { isReservedSource } from "./reserved-sources.js";
import type { DataRef, SourceRegistry, SourceSpec } from "./types.js";

type LoopFrame = { item?: unknown; index?: number };
type ScopeChain = { frames: LoopFrame[] };

const SCOPE_SYMBOL: unique symbol = Symbol.for("storyforge.prompt.scope");
const BASE_SYMBOL: unique symbol = Symbol.for("storyforge.prompt.base");

function currentFrame(scope: ScopeChain): LoopFrame | undefined {
  return scope.frames[scope.frames.length - 1];
}

function parentFrame(scope: ScopeChain, level: number): LoopFrame | undefined {
  if (level < 1) return undefined;
  const idx = scope.frames.length - 1 - level;
  if (idx < 0) return undefined;
  return scope.frames[idx];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function hasArgs(x: unknown): x is { args?: unknown } {
  return isRecord(x) && "args" in x;
}

function getPathArg(ref: unknown): string | undefined {
  if (!hasArgs(ref)) return undefined;
  const a = ref.args;
  if (!isRecord(a)) return undefined;
  const p = a.path;
  return typeof p === "string" ? p : undefined;
}

function getLevelArg(ref: unknown): number {
  if (!hasArgs(ref)) return 1;
  const a = ref.args;
  if (!isRecord(a)) return 1;
  const lvl = a.level;
  return typeof lvl === "number" && Number.isFinite(lvl) ? Math.max(1, lvl) : 1;
}

function getGlobals(ctx: unknown): unknown {
  return isRecord(ctx) && "globals" in ctx ? ctx.globals : undefined;
}

class ScopedRegistry<Ctx extends object, S extends SourceSpec> implements SourceRegistry<Ctx, S> {
  public readonly [SCOPE_SYMBOL]: ScopeChain;
  public readonly [BASE_SYMBOL]: SourceRegistry<Ctx, S>;

  constructor(base: SourceRegistry<Ctx, S>, scope: ScopeChain) {
    this[BASE_SYMBOL] = base;
    this[SCOPE_SYMBOL] = scope;
  }

  resolve<K extends keyof S & string>(
    ref: DataRef<K, S[K]["args"]>,
    ctx: Ctx
  ): S[K]["out"] | undefined {
    const src = String(ref.source);
    if (!isReservedSource(src)) {
      return this[BASE_SYMBOL].resolve(ref, ctx);
    }

    switch (src) {
      case "$item": {
        const path = getPathArg(ref);
        const v = currentFrame(this[SCOPE_SYMBOL])?.item;
        return path ? resolvePath({ value: v }, `value.${path}`) : v;
      }
      case "$index": {
        return currentFrame(this[SCOPE_SYMBOL])?.index;
      }
      case "$parent": {
        const level = getLevelArg(ref);
        const path = getPathArg(ref);
        const v = parentFrame(this[SCOPE_SYMBOL], level)?.item;
        return path ? resolvePath({ value: v }, `value.${path}`) : v;
      }
      case "$globals": {
        const path = getPathArg(ref);
        const v = getGlobals(ctx);
        return path ? resolvePath({ value: v }, `value.${path}`) : v;
      }
      case "$ctx": {
        const path = getPathArg(ref);
        return path ? resolvePath({ value: ctx }, `value.${path}`) : ctx;
      }
      default:
        return undefined;
    }
  }

  list(): Array<keyof S & string> {
    return this[BASE_SYMBOL].list?.() ?? [];
  }
}

export function makeScopedRegistry<Ctx extends object, S extends SourceSpec>(
  base: SourceRegistry<Ctx, S>,
  scope: ScopeChain
): SourceRegistry<Ctx, S> {
  return new ScopedRegistry(base, scope);
}

export function withAdditionalFrame<Ctx extends object, S extends SourceSpec>(
  reg: SourceRegistry<Ctx, S>,
  frame: LoopFrame
): SourceRegistry<Ctx, S> {
  const frames = reg instanceof ScopedRegistry ? reg[SCOPE_SYMBOL].frames : [];
  const base = reg instanceof ScopedRegistry ? reg[BASE_SYMBOL] : reg;
  return new ScopedRegistry(base, { frames: [...frames, frame] });
}
