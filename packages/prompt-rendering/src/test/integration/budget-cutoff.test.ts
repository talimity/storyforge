import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "../../budget-manager.js";
import { compileTemplate } from "../../compiler.js";
import { render } from "../../renderer.js";
import {
  largeTurnGenCtx,
  standardTurnGenCtx,
} from "../fixtures/contexts/turn-generation-contexts.js";
import {
  type FakeTurnGenSourceSpec,
  makeSpecTurnGenerationRegistry,
} from "../fixtures/registries/turn-generation-registry.js";
import turnWriterV2Json from "../fixtures/templates/spec/tpl_turn_writer_v2.json" with {
  type: "json",
};

describe("Budget Cut-off Behavior", () => {
  const registry = makeSpecTurnGenerationRegistry();

  it("should terminate forEach loops early when global budget exhausted", () => {
    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(turnWriterV2Json);

    // Use constrained budget vs generous budget
    const smallBudget = new DefaultBudgetManager({ maxTokens: 800 });
    const largeBudget = new DefaultBudgetManager({ maxTokens: 5000 });

    const smallResult = render(compiled, largeTurnGenCtx, smallBudget, registry);
    const largeResult = render(compiled, largeTurnGenCtx, largeBudget, registry);

    // Both should have basic structure (layout messages should always render)
    expect(smallResult.some((m) => m.role === "system")).toBe(true);
    expect(largeResult.some((m) => m.role === "system")).toBe(true);

    // But small budget should have fewer slot-generated messages
    const smallTurnMsgs = smallResult.filter((m) => m.content?.match(/^\[\d+]/));
    const largeTurnMsgs = largeResult.filter((m) => m.content?.match(/^\[\d+]/));

    expect(smallTurnMsgs.length).toBeLessThanOrEqual(largeTurnMsgs.length);

    // Snapshot the small budget result for regression testing
    expect(smallResult).toMatchSnapshot("budget-cutoff-small");
  });

  it("should respect slot-level budget limits", () => {
    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(turnWriterV2Json);

    // The template has slot budgets:
    // turns: 900 tokens, summaries: 700 tokens, examples: 500 tokens

    const budget = new DefaultBudgetManager({ maxTokens: 10000 });
    const messages = render(compiled, largeTurnGenCtx, budget, registry);

    // Each slot should respect its individual budget limit
    // even when global budget allows more

    // Count messages per slot type
    const turnMessages = messages.filter((m) => m.content?.match(/^\[\d+]/));
    const summaryMessages = messages.filter((m) => m.content?.match(/^Ch \d+:/));

    // Turn messages should be limited by slot budget, not exceed what 900 tokens allows
    // (Exact count depends on content length, but should be reasonable)
    expect(turnMessages.length).toBeLessThan(largeTurnGenCtx.turns.length);
    expect(summaryMessages.length).toBeLessThan(largeTurnGenCtx.chapterSummaries.length);

    // Snapshot for slot budget behavior
    expect(messages).toMatchSnapshot("slot-budget-limits");
  });

  it("should produce stable output with budget constraints", () => {
    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(turnWriterV2Json);

    // Render multiple times with same budget constraint
    const budget1 = new DefaultBudgetManager({ maxTokens: 800 });
    const budget2 = new DefaultBudgetManager({ maxTokens: 800 });
    const budget3 = new DefaultBudgetManager({ maxTokens: 800 });

    const result1 = render(compiled, largeTurnGenCtx, budget1, registry);
    const result2 = render(compiled, largeTurnGenCtx, budget2, registry);
    const result3 = render(compiled, largeTurnGenCtx, budget3, registry);

    // All results should be identical (deterministic)
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);

    // Snapshot for stable budget-constrained output
    expect(result1).toMatchSnapshot("stable-budget-constrained");
  });

  it("should handle stopWhenOutOfBudget flag correctly", () => {
    // Create a custom template with stopWhenOutOfBudget explicitly set to true
    const customTemplate = {
      ...turnWriterV2Json,
      id: "budget_test_template",
      layout: [
        {
          kind: "message",
          role: "system",
          content: "You write vivid, concise third-person prose.",
        },
        { kind: "slot", name: "turns", omitIfEmpty: true },
      ],
      slots: {
        turns: {
          priority: 0,
          budget: { maxTokens: 200 }, // Very small slot budget
          plan: [
            {
              kind: "forEach",
              source: { source: "turns", args: { order: "desc", limit: 20 } },
              map: [
                {
                  kind: "message",
                  role: "user",
                  content: "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}",
                },
              ],
              budget: { maxTokens: 200 },
              stopWhenOutOfBudget: true, // Explicit early stop
            },
          ],
        },
      },
    };

    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(customTemplate);

    const budget = new DefaultBudgetManager({ maxTokens: 10000 });
    const result = render(compiled, largeTurnGenCtx, budget, registry);

    // Should stop early due to slot budget + stopWhenOutOfBudget=true
    const turnMessages = result.filter((m) => m.content?.match(/^\[\d+]/));
    expect(turnMessages.length).toBeLessThan(10); // Should be much less than the 20+ turns available

    // Should still have valid structure
    expect(result.length).toBeGreaterThan(2); // At least system + user messages
  });

  it("should handle zero budget gracefully", () => {
    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(turnWriterV2Json);

    // Budget that's already exhausted
    const zeroBudget = new DefaultBudgetManager({ maxTokens: 0 });
    const result = render(compiled, standardTurnGenCtx, zeroBudget, registry);

    // Should still return some basic structure, even with no budget
    // Implementation might vary, but should not crash
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});
