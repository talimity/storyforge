import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "./budget-manager.js";
import { compileTemplate } from "./compiler.js";
import { executeSlots } from "./slot-executor.js";
import { sampleTurnGenCtx } from "./test/fixtures/test-contexts.js";
import { makeTurnGenTestRegistry } from "./test/fixtures/test-registries.js";
import type { LayoutNode, PromptTemplate, SlotSpec } from "./types.js";

const charEstimator = (text: string) => text.length;

describe("slot executor", () => {
  const ctx = sampleTurnGenCtx;
  const registry = makeTurnGenTestRegistry();

  function createBudget(maxTokens = 500): DefaultBudgetManager {
    return new DefaultBudgetManager({ maxTokens }, charEstimator);
  }

  it("executes slots by ascending priority and returns buffers", () => {
    const compiled = compileTemplate(
      makeTemplate({
        earlier: {
          priority: 0,
          plan: [{ kind: "message", role: "user", content: "first" }],
          meta: {},
        },
        later: {
          priority: 1,
          plan: [{ kind: "message", role: "user", content: "second" }],
          meta: {},
        },
      })
    );

    const result = executeSlots(compiled.slots, ctx, createBudget(), registry);
    expect(result.earlier.messages).toHaveLength(1);
    expect(result.earlier.messages[0].content).toBe("first");
    expect(result.later.messages[0].content).toBe("second");
    expect(result.earlier.anchors).toHaveLength(0);
  });

  it("skips slots whose condition evaluates false", () => {
    const compiled = compileTemplate(
      makeTemplate({
        active: {
          priority: 0,
          when: { type: "exists", ref: { source: "turns" } },
          plan: [{ kind: "message", role: "user", content: "ok" }],
          meta: {},
        },
        skipped: {
          priority: 1,
          when: { type: "nonEmpty", ref: { source: "emptyArray" } },
          plan: [{ kind: "message", role: "user", content: "nope" }],
          meta: {},
        },
      })
    );

    const result = executeSlots(compiled.slots, ctx, createBudget(), registry);
    expect(result.active.messages).toHaveLength(1);
    expect(result.skipped.messages).toHaveLength(0);
    expect(result.skipped.anchors).toHaveLength(0);
  });

  it("collects anchors emitted within plan nodes", () => {
    const compiled = compileTemplate(
      makeTemplate({
        timeline: {
          priority: 0,
          plan: [
            {
              kind: "forEach",
              source: { source: "turns" },
              map: [
                { kind: "message", role: "user", content: "Turn {{ item.turnNo }}" },
                { kind: "anchor", key: "turn_{{ item.turnNo }}" },
              ],
            },
          ],
          meta: {},
        },
      })
    );

    const result = executeSlots(compiled.slots, ctx, createBudget(), registry);

    expect(result.timeline.messages).not.toHaveLength(0);
    expect(result.timeline.anchors).not.toHaveLength(0);
    const firstAnchor = result.timeline.anchors[0];
    expect(firstAnchor.key).toBe(`turn_${ctx.turns[0].turnNo}`);
    expect(firstAnchor.index).toBe(1);
  });

  it("retains anchors when items prepend", () => {
    const compiled = compileTemplate(
      makeTemplate({
        reverse: {
          priority: 0,
          plan: [
            {
              kind: "forEach",
              source: { source: "turns" },
              fillDir: "prepend",
              limit: 2,
              map: [
                { kind: "anchor", key: "rev_{{ item.turnNo }}" },
                { kind: "message", role: "user", content: "R{{ item.turnNo }}" },
              ],
            },
          ],
          meta: {},
        },
      })
    );

    const result = executeSlots(compiled.slots, ctx, createBudget(), registry);
    const expectedTurn = ctx.turns[1].turnNo;
    expect(result.reverse.messages[0].content).toBe(`R${expectedTurn}`);
    expect(result.reverse.anchors[0].key).toBe(`rev_${expectedTurn}`);
    expect(result.reverse.anchors[0].index).toBe(0);
  });

  it("stops lower-priority slots when budget is exhausted", () => {
    const compiled = compileTemplate(
      makeTemplate({
        greedy: {
          priority: 0,
          plan: [{ kind: "message", role: "user", content: "four" }],
          meta: {},
        },
        deferred: {
          priority: 1,
          plan: [{ kind: "message", role: "user", content: "short" }],
          meta: {},
        },
      })
    );

    const budget = createBudget(4);
    const result = executeSlots(compiled.slots, ctx, budget, registry);
    expect(result.greedy.messages).toHaveLength(1);
    expect(result.deferred.messages).toHaveLength(0);
  });
});

function makeTemplate(slots: Record<string, SlotSpec<any>>): PromptTemplate<string, any> {
  const layout: LayoutNode<any>[] = Object.keys(slots).map((name) => ({
    kind: "slot",
    name,
    omitIfEmpty: true,
  }));

  return {
    id: "slot-test",
    task: "test",
    name: "Slot Test",
    version: 1,
    layout,
    slots,
  };
}
