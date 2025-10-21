import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "./budget-manager.js";
import { compileTemplate } from "./compiler.js";
import { render } from "./renderer.js";
import { sampleTurnGenCtx } from "./test/fixtures/test-contexts.js";
import { makeTurnGenTestRegistry } from "./test/fixtures/test-registries.js";
import type { PromptTemplate } from "./types.js";

const charEstimator = (text: string) => text.length;

describe("renderer", () => {
  const registry = makeTurnGenTestRegistry();
  const ctx = sampleTurnGenCtx;

  function compile(template: PromptTemplate<string, any>): ReturnType<typeof compileTemplate> {
    return compileTemplate<string, any>(template);
  }

  function createBudget(maxTokens: number): DefaultBudgetManager {
    return new DefaultBudgetManager({ maxTokens }, charEstimator);
  }

  it("renders template with layout, slot, and anchors", () => {
    const template = compile({
      id: "test",
      task: "turn",
      name: "Test",
      version: 1,
      layout: [
        { kind: "message", role: "system", content: "Intro" },
        { kind: "slot", name: "timeline" },
        { kind: "anchor", key: "after_timeline" },
        { kind: "message", role: "user", content: "Good luck" },
      ],
      slots: {
        timeline: {
          priority: 0,
          plan: [
            {
              kind: "forEach",
              source: { source: "turns" },
              map: [
                { kind: "message", role: "user", content: "Turn" },
                { kind: "anchor", key: "turn_anchor" },
              ],
            },
          ],
          meta: {},
        },
      },
    });

    const messages = render(template, ctx, createBudget(100), registry);

    expect(messages[0].content).toBe("Intro");
    expect(messages[messages.length - 1].content).toContain("Good luck");
  });

  it("keeps layout instructions even when slot fills nearly all budget", () => {
    const template = compile({
      id: "heavy",
      task: "turn",
      name: "Heavy",
      version: 1,
      layout: [
        { kind: "slot", name: "timeline" },
        { kind: "message", role: "system", content: "Do not drop" },
      ],
      slots: {
        timeline: {
          priority: 0,
          plan: [
            {
              kind: "forEach",
              source: { source: "turns" },
              map: [{ kind: "message", role: "user", content: "Very long turn content" }],
            },
          ],
          meta: {},
        },
      },
    });

    const messages = render(template, ctx, createBudget(80), registry);
    expect(messages[messages.length - 1].content).toBe("Do not drop");
  });

  it("injects attachment content relative to anchors", () => {
    const template = compile({
      id: "attach",
      task: "turn",
      name: "Attach",
      version: 1,
      layout: [{ kind: "slot", name: "timeline" }],
      slots: {
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
      },
      attachments: [
        {
          id: "lore",
          order: 1,
          template: "Lore: {{ payload.text }}",
          role: "system",
          reserveTokens: 4,
        },
      ],
    });

    const budget = createBudget(40);
    const messages = render(template, ctx, budget, registry, {
      attachments: [
        { id: "lore", template: "Lore: {{ payload.text }}", role: "system", reserveTokens: 16 },
      ],
      injections: [
        {
          lane: "lore",
          payload: { text: "Forest" },
          target: { kind: "at", key: "turn_1", after: true },
        },
      ],
    });

    const loreIndex = messages.findIndex((msg) => msg.content.includes("Lore:"));
    expect(loreIndex).toBeGreaterThan(-1);
    if (loreIndex >= 0) {
      expect(messages[loreIndex].content).toBe("Lore: Forest");
    }
  });

  it("inserts injections at top when anchor is missing", () => {
    const template = compile({
      id: "fallback",
      task: "turn",
      name: "Fallback",
      version: 1,
      layout: [{ kind: "message", role: "system", content: "Static" }],
      slots: {},
    });

    const budget = createBudget(20);
    const messages = render(template, ctx, budget, registry, {
      injections: [
        {
          lane: "lore",
          target: [
            { kind: "at", key: "missing" },
            { kind: "boundary", position: "top" },
          ],
          template: "Fallback",
          role: "system",
        },
      ],
      attachments: [{ id: "lore", order: 0, reserveTokens: 4 }],
    });

    expect(messages[0].content.startsWith("Fallback")).toBe(true);
  });

  it("ignores disabled attachment lanes", () => {
    const template = compile({
      id: "disabled",
      task: "turn",
      name: "Disabled",
      version: 1,
      layout: [{ kind: "slot", name: "timeline" }],
      slots: {
        timeline: {
          priority: 0,
          plan: [{ kind: "message", role: "user", content: "Original" }],
          meta: {},
        },
      },
      attachments: [{ id: "lore", reserveTokens: 4, enabled: false }],
    });

    const messages = render(template, ctx, createBudget(20), registry, {
      injections: [
        { lane: "lore", target: { kind: "at", key: "turn_1" }, template: "Should not render" },
      ],
    });

    expect(messages.some((msg) => msg.content.includes("Should not render"))).toBe(false);
  });
});
