- Let DataRefs inside forEach map (and nested if/map nodes) access the current iteration scope
  without modifying app registries or the SourceRegistry API.

Design Overview

- Introduce reserved DataRef sources handled by a scoped registry wrapper created by the engine
  during forEach execution:
    - $item: returns the current loop item; optional args.path to extract a property.
    - $index: returns the current loop index (0-based).
    - $parent: returns the parent loop item; optional args.level (default 1) and args.path.
    - $globals: returns ctx.globals; optional args.path.
    - $ctx: returns ctx; optional args.path.
- The wrapper delegates all non-reserved sources to the underlying registry.
- compileTemplate automatically allows reserved sources in linting to avoid author-time false
  positives.

Scope Semantics

- Resolution precedence:
    - Inside forEach map: $item and $index refer to the innermost loop frame; $parent refers to the
      immediate outer frame (increase via args.level).
    - Outside loops: $item/$index/$parent resolve to undefined; $globals/$ctx always available.
- Path semantics: Same dotted/bracket rules as the leaf compiler, e.g. "description",
  "examples[0].text".
- Types: No public type changes required; reserved sources flow through existing Unbound schema and
  runtime linting allows them.

Implementation Plan

1. Define Reserved Names and Shared Path Resolver

- Add packages/prompt-rendering/src/reserved-sources.ts
    - export const RESERVED_SOURCES = ["$item", "$index", "$parent", "$globals", "$ctx"] as const;
    - export type ReservedSource = typeof RESERVED_SOURCES[number];
    - Document argument shapes:
    - $item: { path?: string }
    - $index: {}
    - $parent: { level?: number; path?: string }
    - $globals: { path?: string }
    - $ctx: { path?: string }
- Extract the path resolution helper from leaf-compiler into packages/prompt-rendering/src/path-
  resolver.ts
    - export resolvePath(obj: unknown, path: string): unknown
    - Update leaf-compiler to import and use this function (keep behavior identical).

2. Scoped Registry Wrapper

- Add packages/prompt-rendering/src/scoped-registry.ts
    - export type LoopFrame = { item?: unknown; index?: number };
    - export type ScopeChain = { frames: LoopFrame[]; ctx: object };
    - export function makeScopedRegistry<Ctx, S extends SourceSpec>(
      base: SourceRegistry<Ctx, S>,
      scope: ScopeChain
      ): SourceRegistry<Ctx, S>
    - resolve(ref, ctx):
        - If ref.source is reserved:
            - "$item": return value = currentFrame.item; if args.path present, resolvePath(value,
              args.path).
            - "$index": return currentFrame.index.
            - "$parent": pick frame from scope.frames[frames.length - 1 - (args.level ?? 1)]; if found,
              return that item (apply path if given).
            - "$globals": return ctx.globals (apply path if given).
            - "$ctx": return ctx (apply path if given).
        - Else delegate to base.resolve(ref, ctx).
    - list(): merge base.list() with RESERVED_SOURCES for convenience/diagnostics (even if compile
      path also allows them).
- Notes:
    - “currentFrame” is the last element in frames; if frames empty, $item/$index undefined.
    - Keep wrapper allocation cheap (shallow object capturing base + ScopeChain reference).

3. Integrate Wrapper Into Execution

- plan-executor.ts:
    - executeForEachNode:
    - Maintain a parent ScopeChain (incoming, default { frames: [], ctx }).
    - When iterating items, create a childScope = { frames: [...parent.frames, { item, index: i }],
      ctx }.
    - Create regWithScope = makeScopedRegistry(registry, childScope).
    - For each child node: call executePlanNode(child, ctx, budget, regWithScope, item).
    - When rendering interleave.separator text, leaf templating already gets item via
      createScope(ctx, item); no change.
- executePlanNode, executeMessageNode, executeIfNode:
    - No signature changes.
    - They all receive the registry parameter; if called under a loop, it will be the scoped
      wrapper. No further changes needed.
- layout-assembler.ts:
    - No loop scope there; reserve optional support for $globals/$ctx via a top-level wrapper if
      desired, but not required. Safer to keep current behavior and rely on compiler change to allow
      reserved names where used.

4. Allow Reserved Names in Author-Time Linting

- compiler.ts:
    - When calling parseTemplate(..., options?.allowedSources), extend the list with
      RESERVED_SOURCES before linting:
    - const allowed = options?.allowedSources ? [...options.allowedSources, ...RESERVED_SOURCES] :
      undefined;
    - parseTemplate(json, options?.kind, allowed).
- Alternative (not necessary if you prefer centralizing): lintSourceNames could merge
  RESERVED_SOURCES into the Set it receives; but adding it in compiler keeps responsibilities
  separated and avoids leaking reserved knowledge into lintSourceNames.

5. Tests

- Unit: scoped-registry.test.ts
    - Resolves $item.path, $index, $parent.level, $globals.path, $ctx.path.
    - Behavior when no frames (outside loops) → $item/$index/$parent undefined.
- Integration: extend src/test/integration
    - New template exercising:
    - forEach over characters; map includes:
        - if node with when: { type: "nonEmpty", ref: { source: "$item", args: { path:
          "description" } } }
        - message.from using $item.path to emit raw description (verifies JSON.stringify vs string
          branch).
    - Nested forEach to verify $parent with level:1.
    - Confirm determinism and that messages match expected order.
- Source linter tests:
    - Ensure compileTemplate with allowedSources from registry does not throw when templates use
      reserved sources.
- Condition evaluator tests:
    - exists/nonEmpty/eq using $item and $parent.

6. Documentation and Author Guidance

- docs/prompt-template-engine-specification.md
    - Add “Reserved Sources” section describing $item/$index/$parent/$globals/$ctx, args and scope
      rules, nested loop semantics, availability outside loops.
    - Update examples to show:
    - when: { type: "nonEmpty", ref: { source: "$item", args: { path: "description" } } }
    - message.from: { source: "$ctx", args: { path: "currentIntent.description" } }
- apps/frontend authoring UI (future): surface a small hint when editing DataRef conditions/From
  fields inside a map: “Reserved sources: $item, $index, $parent. Example: $item.path=description”.

7. Migration and Compatibility

- No changes to SourceRegistry interface used by apps; registries remain untouched.
- AllowedSources:
    - Runner today passes allowedSources = registry.list(); compiler merges reserved names, so no
      runner change required.
- Runtime behavior:
    - Templates not using reserved names remain unaffected.
    - Using reserved names outside a loop yields undefined (exists=false, nonEmpty=false), which is
      sensible and deterministic.

8. Edge Cases and Decisions

- Non-string $item with message.from:
    - Engine already JSON.stringify’s non-strings; document this and recommend specifying args.path
      for strings when used in from.
- Large ctx/globals via $ctx/$globals:
    - Same stringify rule; advise authors to use path to avoid huge strings.
- Deep parent access:
    - args.level default 1; enforce level >= 1; if level exceeds chain, result undefined.
- Performance:
    - Wrapper creation per iteration is cheap; resolution is O(1) over reserved checks; path
      resolution complexity identical to leaf templating.

9. Acceptance Criteria

- DataRefs inside forEach map (and nested if/map under it) can:
    - Read current item fields for conditions and from.
    - Read current index.
    - Read parent item fields in nested loops.
- Templates compile without linter errors when reserved names appear, given a normal registry
  list().
- No changes required to existing registries or the gentasks runner.
- All new tests pass; determinism tests remain green.

10. Post-merge Validation Targets

- Update the characters-recipe comment and add an example condition:
    - when: { type: "nonEmpty", ref: { source: "$item", args: { path: "description" } } }
- Create a minimal template in examples using both template strings and DataRefs on the same scope
  to validate parity.
