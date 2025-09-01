import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "../../budget-manager.js";
import { compileTemplate } from "../../compiler.js";
import { render } from "../../renderer.js";
import { parseTemplate } from "../../schemas.js";
import { standardTurnGenCtx } from "../fixtures/contexts/turn-generation-contexts.js";
import {
  type FakeTurnGenSourceSpec,
  makeSpecTurnGenerationRegistry,
} from "../fixtures/registries/turn-generation-registry.js";
import turnPlannerV1Json from "../fixtures/templates/spec/tpl_turn_planner_v1.json" with {
  type: "json",
};

describe("Assistant Prefix Emission", () => {
  const registry = makeSpecTurnGenerationRegistry();

  it("should emit assistant message with prefix=true", () => {
    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(
      turnPlannerV1Json
    );

    const budget = new DefaultBudgetManager({ maxTokens: 5000 });
    const messages = render(compiled, standardTurnGenCtx, budget, registry);

    // Find the assistant message with prefix
    const assistantPrefixMsg = messages.find(
      (m) => m.role === "assistant" && m.prefix === true
    );

    expect(assistantPrefixMsg).toBeDefined();
    expect(assistantPrefixMsg).toMatchObject({
      role: "assistant",
      content: '{"goals":',
      prefix: true,
    });
  });

  it("should place prefix message at correct position in layout", () => {
    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(
      turnPlannerV1Json
    );

    const budget = new DefaultBudgetManager({ maxTokens: 5000 });
    const messages = render(compiled, standardTurnGenCtx, budget, registry);

    // The assistant prefix should be the last message according to the layout
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage).toMatchObject({
      role: "assistant",
      content: '{"goals":',
      prefix: true,
    });

    // Should come after the instruction to produce JSON
    const jsonInstructionIndex = messages.findIndex((m) =>
      m.content?.includes("Return JSON with keys")
    );
    const prefixIndex = messages.findIndex(
      (m) => m.role === "assistant" && m.prefix === true
    );

    expect(jsonInstructionIndex).toBeGreaterThan(-1);
    expect(prefixIndex).toBeGreaterThan(jsonInstructionIndex);
  });

  it("should render slots before assistant prefix", () => {
    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(
      turnPlannerV1Json
    );

    const budget = new DefaultBudgetManager({ maxTokens: 5000 });
    const messages = render(compiled, standardTurnGenCtx, budget, registry);

    const prefixIndex = messages.findIndex(
      (m) => m.role === "assistant" && m.prefix === true
    );

    // Should have slot content before the prefix
    const hasTurnContent = messages
      .slice(0, prefixIndex)
      .some((m) => m.content?.match(/^\[\d+\]/));
    const hasCharContent = messages
      .slice(0, prefixIndex)
      .some((m) => m.content?.includes(" — "));

    expect(hasTurnContent).toBe(true);
    expect(hasCharContent).toBe(true);
  });

  it("should handle prefix with minimal context", () => {
    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(
      turnPlannerV1Json
    );

    // Use empty context to test prefix with minimal slots
    const emptyCtx = {
      turns: [],
      chapterSummaries: [],
      characters: [],
      currentIntent: {
        description: "Test with empty context",
        constraint: "Generate minimal plan",
      },
      stepInputs: {},
      globals: {},
    };

    const budget = new DefaultBudgetManager({ maxTokens: 5000 });
    const messages = render(compiled, emptyCtx, budget, registry);

    // Should still have assistant prefix even with empty slots
    const assistantMsg = messages.find(
      (m) => m.role === "assistant" && m.prefix
    );
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.content).toBe('{"goals":');

    // Should have basic structure
    expect(messages.some((m) => m.role === "system")).toBe(true);
    expect(messages.some((m) => m.content?.includes("Constraint:"))).toBe(true);

    // Snapshot for minimal context
    expect(messages).toMatchSnapshot("assistant-prefix-minimal-context");
  });

  it("should validate prefix can only be on assistant role", () => {
    // This tests the validation that should happen at template compilation
    const invalidTemplate = {
      ...turnPlannerV1Json,
      id: "invalid_prefix_test",
      layout: [
        { kind: "message", role: "system", content: "Test" },
        { kind: "message", role: "user", content: "Invalid", prefix: true }, // Invalid: user with prefix
      ],
    };

    // Should throw during parsing/compilation due to invalid prefix on user role
    expect(() => {
      const template = parseTemplate(invalidTemplate);
      compileTemplate(template);
    }).toThrow();
  });

  it("should preserve prefix flag through compilation", () => {
    const template = parseTemplate(turnPlannerV1Json);
    const compiled = compileTemplate(template);

    // Check that the compiled template preserves prefix information
    const layoutMsg = compiled.layout.find(
      (node) => node.kind === "message" && (node as any).prefix === true
    ) as any;

    expect(layoutMsg).toBeDefined();
    expect(layoutMsg.prefix).toBe(true);
    expect(layoutMsg.role).toBe("assistant");
  });

  it("should handle budget constraints with prefix message", () => {
    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(
      turnPlannerV1Json
    );

    // Constrained budget but enough for layout messages
    const smallBudget = new DefaultBudgetManager({ maxTokens: 800 });
    const messages = render(
      compiled,
      standardTurnGenCtx,
      smallBudget,
      registry
    );

    // Even with tight budget, prefix message should still be included
    // (it's part of the layout, not slot content)
    const assistantMsg = messages.find(
      (m) => m.role === "assistant" && m.prefix
    );
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.content).toBe('{"goals":');

    // But slot content might be truncated due to budget constraints
    const turnMsgs = messages.filter((m) => m.content?.match(/^\[\d+\]/));
    // Note: With budget=800 and standardTurnGenCtx having 6 turns, some may be truncated
    expect(turnMsgs.length).toBeLessThanOrEqual(
      standardTurnGenCtx.turns.length
    );
  });
});
