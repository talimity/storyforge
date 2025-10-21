import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "./budget-manager.js";
import { compileTemplate } from "./compiler.js";
import { assembleLayout, prepareLayout } from "./layout-assembler.js";
import { makeScopedRegistry } from "./scoped-registry.js";
import type { SlotExecutionResult } from "./slot-executor.js";
import { sampleTurnGenCtx } from "./test/fixtures/test-contexts.js";
import { makeTurnGenTestRegistry } from "./test/fixtures/test-registries.js";
import type { LayoutNode, PromptTemplate, SlotSpec } from "./types.js";

const charEstimator = (text: string) => text.length;

describe("layout assembler", () => {
  const baseRegistry = makeScopedRegistry(makeTurnGenTestRegistry(), { frames: [] });
  const ctx = sampleTurnGenCtx;

  function createBudget(maxTokens = 200): DefaultBudgetManager {
    return new DefaultBudgetManager({ maxTokens }, charEstimator);
  }

  it("prepares layout blocks and computes floor", () => {
    const compiled = compileTemplate(
      makeTemplate(
        [
          { kind: "message", role: "system", content: "Intro" },
          {
            kind: "slot",
            name: "timeline",
            header: { role: "system", content: "Header" },
          },
          { kind: "anchor", key: "bottom" },
        ],
        {
          timeline: { priority: 0, plan: [], meta: {} },
        }
      )
    );

    const prepared = prepareLayout(compiled.layout, ctx, baseRegistry, createBudget());
    expect(prepared.floor).toBeGreaterThan(0);
    expect(prepared.nodes).toHaveLength(3);
    expect(prepared.nodes[2]).toEqual({ kind: "anchor", key: "bottom" });
  });

  it("assembles layout, inserts slot content, and preserves anchors", () => {
    const compiled = compileTemplate(
      makeTemplate(
        [
          { kind: "message", role: "system", content: "Intro" },
          {
            kind: "slot",
            name: "timeline",
            header: { role: "system", content: "Header" },
            footer: { role: "system", content: "Footer" },
          },
          { kind: "anchor", key: "bottom" },
        ],
        {
          timeline: { priority: 0, plan: [], meta: {} },
        }
      )
    );

    const prepared = prepareLayout(compiled.layout, ctx, baseRegistry, createBudget());

    const slotBuffers: SlotExecutionResult = {
      timeline: {
        messages: [
          { role: "user", content: "Turn 1" },
          { role: "user", content: "Turn 2" },
        ],
        anchors: [
          { key: "turn_1", index: 1 },
          { key: "turn_2", index: 2 },
        ],
      },
    };

    const budget = createBudget();
    budget.reserveFloor("layout", prepared.floor);
    const assembled = assembleLayout(prepared, slotBuffers, budget);

    expect(assembled.messages.map((m) => m.content)).toEqual([
      "Intro",
      "Header",
      "Turn 1",
      "Turn 2",
      "Footer",
    ]);
    expect(assembled.anchors).toEqual([
      { key: "turn_1", index: 3, source: "slot", slotName: "timeline" },
      { key: "turn_2", index: 4, source: "slot", slotName: "timeline" },
      { key: "bottom", index: 5, source: "layout" },
    ]);
  });

  it("omits headers when slot empty and omitIfEmpty not disabled", () => {
    const compiled = compileTemplate(
      makeTemplate(
        [
          {
            kind: "slot",
            name: "empty",
            header: { role: "system", content: "Header" },
          },
        ],
        {
          empty: { priority: 0, plan: [], meta: {} },
        }
      )
    );

    const prepared = prepareLayout(compiled.layout, ctx, baseRegistry, createBudget());
    const budget = createBudget();
    budget.reserveFloor("layout", prepared.floor);

    const slotBuffers: SlotExecutionResult = {
      empty: { messages: [], anchors: [] },
    };

    const assembled = assembleLayout(prepared, slotBuffers, budget);
    expect(assembled.messages).toHaveLength(0);
  });

  it("releases reserved header floor when slot is omitted", () => {
    const compiled = compileTemplate(
      makeTemplate(
        [
          {
            kind: "slot",
            name: "empty",
            header: { role: "system", content: "Header" },
          },
        ],
        {
          empty: { priority: 0, plan: [], meta: {} },
        }
      )
    );

    const prepared = prepareLayout(compiled.layout, ctx, baseRegistry, createBudget());
    const budget = new DefaultBudgetManager({ maxTokens: 20 }, charEstimator);
    budget.reserveFloor("layout", prepared.floor);
    expect(budget.canFitTokenEstimate("X".repeat(20))).toBe(false);

    assembleLayout(
      prepared,
      {
        empty: { messages: [], anchors: [] },
      },
      budget
    );

    expect(budget.canFitTokenEstimate("X".repeat(20))).toBe(true);
  });

  it("includes headers when omitIfEmpty is false", () => {
    const compiled = compileTemplate(
      makeTemplate(
        [
          {
            kind: "slot",
            name: "empty",
            omitIfEmpty: false,
            header: { role: "system", content: "Header" },
          },
        ],
        {
          empty: { priority: 0, plan: [], meta: {} },
        }
      )
    );

    const prepared = prepareLayout(compiled.layout, ctx, baseRegistry, createBudget());
    const budget = createBudget();
    budget.reserveFloor("layout", prepared.floor);

    const assembled = assembleLayout(prepared, { empty: { messages: [], anchors: [] } }, budget);
    expect(assembled.messages).toEqual([{ role: "system", content: "Header" }]);
  });

  it("skips conditional layout messages when condition fails", () => {
    const compiled = compileTemplate(
      makeTemplate(
        [
          {
            kind: "message",
            role: "system",
            content: "Hidden",
            when: [{ type: "exists", ref: { source: "$ctx", args: { path: "missing" } } }],
          },
        ],
        {}
      )
    );

    const prepared = prepareLayout(compiled.layout, ctx, baseRegistry, createBudget());
    const assembled = assembleLayout(prepared, {}, createBudget());
    expect(assembled.messages).toHaveLength(0);
  });

  it("throws when layout references an unknown slot", () => {
    const invalidTemplate: PromptTemplate<string, any> = {
      id: "bad",
      task: "test",
      name: "Bad",
      version: 1,
      layout: [{ kind: "slot", name: "missing" }],
      slots: {},
    };

    expect(() => compileTemplate(invalidTemplate)).toThrowError();
  });
});

function makeTemplate(
  layout: LayoutNode<any>[],
  slots: Record<string, SlotSpec<any>>
): PromptTemplate<string, any> {
  return {
    id: "layout-test",
    task: "test",
    name: "Layout Test",
    version: 1,
    layout,
    slots,
  };
}
