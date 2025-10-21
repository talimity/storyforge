import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "./budget-manager.js";
import { compileTemplate } from "./compiler.js";
import {
  createScope,
  executeForEachNode,
  executeMessageNode,
  executePlanNodes,
} from "./plan-executor.js";
import { makeScopedRegistry } from "./scoped-registry.js";
import { makeSpecTurnGenerationRegistry } from "./test/fixtures/registries/turn-generation-registry.js";
import { sampleTurnGenCtx } from "./test/fixtures/test-contexts.js";
import type { CompiledPlanNode, PlanNode, PromptTemplate } from "./types.js";

const charEstimator = (text: string) => text.length;

describe("plan executor", () => {
  const registry = makeScopedRegistry(makeSpecTurnGenerationRegistry(), { frames: [] });
  const ctx = sampleTurnGenCtx;

  function createBudget(): DefaultBudgetManager {
    return new DefaultBudgetManager({ maxTokens: 200 }, charEstimator);
  }

  it("creates scope with ctx and item", () => {
    const item = { foo: "bar" };
    const scope = createScope(ctx, item);
    expect(scope.ctx).toBe(ctx);
    expect(scope.item).toBe(item);
  });

  it("emits message buffers", () => {
    const [node] = compilePlan([{ kind: "message", role: "system", content: "Hello" }]);
    if (node.kind !== "message") throw new Error("expected message node");
    const result = executeMessageNode(node, ctx, createBudget(), registry);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe("Hello");
    expect(result.anchors).toHaveLength(0);
  });

  it("respects message conditions and budgets", () => {
    const [node] = compilePlan([
      {
        kind: "message",
        role: "system",
        content: "ping",
        when: [{ type: "exists", ref: { source: "$ctx", args: { path: "turns" } } }],
        budget: { maxTokens: 4 },
      },
    ]);
    if (node.kind !== "message") throw new Error("expected message node");

    const tightBudget = new DefaultBudgetManager({ maxTokens: 10 }, charEstimator);
    const result = executeMessageNode(node, ctx, tightBudget, registry);
    expect(result.messages).toHaveLength(1);

    const [skipped] = compilePlan([
      {
        kind: "message",
        role: "system",
        content: "Too long for budget",
        budget: { maxTokens: 5 },
      },
    ]);
    if (skipped.kind !== "message") throw new Error("expected message node");
    const skipResult = executeMessageNode(
      skipped,
      ctx,
      new DefaultBudgetManager({ maxTokens: 5 }, charEstimator),
      registry
    );
    expect(skipResult.messages).toHaveLength(0);
  });

  it("resolves message content from data refs", () => {
    const [node] = compilePlan([
      {
        kind: "message",
        role: "user",
        from: { source: "$ctx", args: { path: "turns.0.content" } },
      },
    ]);
    if (node.kind !== "message") throw new Error("expected message node");
    const result = executeMessageNode(node, ctx, createBudget(), registry);
    expect(result.messages[0].content).toBe(ctx.turns[0].content);
  });

  it("collects anchors alongside messages", () => {
    const [node] = compilePlan([
      {
        kind: "forEach",
        source: { source: "turns" },
        map: [
          { kind: "message", role: "user", content: "{{ item.turnNo }}" },
          { kind: "anchor", key: "idx_{{ item.turnNo }}" },
        ],
      },
    ]);

    if (node.kind !== "forEach") throw new Error("expected forEach node");
    const result = executeForEachNode(node, ctx, createBudget(), registry);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.anchors.length).toBeGreaterThan(0);
    expect(result.anchors[0].key).toBe(`idx_${ctx.turns[0].turnNo}`);
    expect(result.anchors[0].index).toBe(1);
  });

  it("supports prepend loops adjusting anchor indices", () => {
    const [node] = compilePlan([
      {
        kind: "forEach",
        source: { source: "turns" },
        fillDir: "prepend",
        limit: 2,
        map: [
          { kind: "anchor", key: "anchor_{{ item.turnNo }}" },
          { kind: "message", role: "user", content: "{{ item.turnNo }}" },
        ],
      },
    ]);

    if (node.kind !== "forEach") throw new Error("expected forEach node");
    const result = executeForEachNode(node, ctx, createBudget(), registry);
    const secondTurn = ctx.turns[1].turnNo;
    expect(result.messages[0].content).toBe(String(secondTurn));
    expect(result.anchors[0].key).toBe(`anchor_${secondTurn}`);
    expect(result.anchors[0].index).toBe(0);
  });

  it("keeps anchors aligned when prepending multi-message buffers", () => {
    const [node] = compilePlan([
      {
        kind: "forEach",
        source: { source: "turns", args: { order: "asc", limit: 3 } },
        fillDir: "prepend",
        map: [
          { kind: "message", role: "user", content: "Before {{ item.turnNo }}" },
          { kind: "message", role: "assistant", content: "After {{ item.turnNo }}" },
          { kind: "anchor", key: "pair_{{ item.turnNo }}" },
        ],
      },
    ]);

    if (node.kind !== "forEach") throw new Error("expected forEach node");
    const result = executeForEachNode(node, ctx, createBudget(), registry);

    expect(result.messages.map((m) => m.content)).toEqual([
      "Before 3",
      "After 3",
      "Before 2",
      "After 2",
      "Before 1",
      "After 1",
    ]);
    expect(result.anchors).toEqual([
      { key: "pair_3", index: 2 },
      { key: "pair_2", index: 4 },
      { key: "pair_1", index: 6 },
    ]);
  });

  it("aggregates sequences of plan nodes", () => {
    const nodes = compilePlan([
      { kind: "message", role: "system", content: "A" },
      { kind: "anchor", key: "middle" },
      { kind: "message", role: "system", content: "B" },
    ]);

    const result = executePlanNodes(nodes, ctx, createBudget(), registry);
    expect(result.messages).toHaveLength(2);
    expect(result.anchors).toHaveLength(1);
    expect(result.anchors[0]).toEqual({ key: "middle", index: 1 });
  });

  it("supports forEach ordering and limits", () => {
    const [node] = compilePlan([
      {
        kind: "forEach",
        source: { source: "turns", args: { order: "desc", limit: 3 } },
        map: [{ kind: "message", role: "user", content: "{{ item.turnNo }}" }],
      },
    ]);

    if (node.kind !== "forEach") throw new Error("expected forEach node");
    const result = executeForEachNode(node, ctx, createBudget(), registry);
    const numbers = result.messages.map((m) => Number.parseInt(m.content, 10));
    const expected = [...ctx.turns]
      .sort((a, b) => b.turnNo - a.turnNo)
      .slice(0, 3)
      .map((t) => t.turnNo);
    expect(numbers).toEqual(expected);
  });

  it("evaluates if/else branches", () => {
    const nodes = compilePlan([
      {
        kind: "if",
        when: { type: "nonEmpty", ref: { source: "turns" } },
        then: [{ kind: "message", role: "system", content: "Has turns" }],
        else: [{ kind: "message", role: "system", content: "No turns" }],
      },
    ]);

    const withTurns = executePlanNodes(nodes, ctx, createBudget(), registry);
    expect(withTurns.messages[0].content).toBe("Has turns");

    const noTurnCtx = { ...ctx, turns: [] };
    const emptyRegistry = makeScopedRegistry(makeSpecTurnGenerationRegistry(), { frames: [] });
    const withoutTurns = executePlanNodes(nodes, noTurnCtx, createBudget(), emptyRegistry);
    expect(withoutTurns.messages[0].content).toBe("No turns");
  });
});

function compilePlan(plan: PlanNode<any>[]): readonly CompiledPlanNode<any>[] {
  const template: PromptTemplate<string, any> = {
    id: "plan-test",
    task: "test",
    name: "Plan Test",
    version: 1,
    layout: [],
    slots: {
      main: {
        priority: 0,
        plan,
        meta: {},
      },
    },
  };
  return compileTemplate(template).slots.main.plan;
}
