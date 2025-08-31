import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "../../budget-manager";
import { compileTemplate } from "../../compiler";
import { render } from "../../renderer";
import {
  emptyTurnGenCtx,
  noTurnsCtx,
  standardTurnGenCtx,
} from "../fixtures/contexts/turn-generation-contexts";
import {
  type FakeTurnGenSourceSpec,
  makeSpecTurnGenerationRegistry,
} from "../fixtures/registries/turn-generation-registry";
import turnWriterV2Json from "../fixtures/templates/spec/tpl_turn_writer_v2.json";

describe("Conditional Slot Omission", () => {
  const registry = makeSpecTurnGenerationRegistry();

  it("should omit examples slot when turns exist", () => {
    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(
      turnWriterV2Json
    );

    const budget = new DefaultBudgetManager({ maxTokens: 5000 });

    // Context with turns - examples should be omitted
    const messagesWithTurns = render(
      compiled,
      standardTurnGenCtx,
      budget,
      registry
    );

    // Should NOT contain examples header or content
    const hasExamplesHeader = messagesWithTurns.some(
      (m) => m.content === "Character writing examples:"
    );
    const hasExampleContent = messagesWithTurns.some((m) =>
      m.content?.includes(" — Example:")
    );

    expect(hasExamplesHeader).toBe(false);
    expect(hasExampleContent).toBe(false);

    // Should still have turns content
    const hasTurnContent = messagesWithTurns.some((m) =>
      m.content?.match(/^\[\d+\]/)
    );
    expect(hasTurnContent).toBe(true);

    // Snapshot for context with turns (no examples)
    expect(messagesWithTurns).toMatchSnapshot("conditional-slots-with-turns");
  });

  it("should include examples slot when no turns exist", () => {
    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(
      turnWriterV2Json
    );
    const budget = new DefaultBudgetManager({ maxTokens: 5000 });

    // Context without turns - examples should be included
    const messagesWithoutTurns = render(compiled, noTurnsCtx, budget, registry);

    // Should contain examples header and content
    const hasExamplesHeader = messagesWithoutTurns.some(
      (m) => m.content === "Character writing examples:"
    );
    const hasExampleContent = messagesWithoutTurns.some((m) =>
      m.content?.includes(" — Example:")
    );

    expect(hasExamplesHeader).toBe(true);
    expect(hasExampleContent).toBe(true);

    // Should NOT have turn content (since there are no turns)
    const hasTurnContent = messagesWithoutTurns.some((m) =>
      m.content?.match(/^\[\d+\]/)
    );
    expect(hasTurnContent).toBe(false);

    // Should still have other content like summaries
    const hasSummaryContent = messagesWithoutTurns.some((m) =>
      m.content?.match(/^Ch \d+:/)
    );
    expect(hasSummaryContent).toBe(true);

    // Snapshot for context without turns (with examples)
    expect(messagesWithoutTurns).toMatchSnapshot(
      "conditional-slots-without-turns"
    );
  });

  it("should handle completely empty context appropriately", () => {
    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(
      turnWriterV2Json
    );

    const budget = new DefaultBudgetManager({ maxTokens: 5000 });

    // Empty context - should include examples but they'll be empty
    const messagesEmpty = render(compiled, emptyTurnGenCtx, budget, registry);

    // Examples slot condition should trigger (no turns)
    // But the forEach loop will have nothing to iterate over

    // The header might or might not appear depending on omitIfEmpty behavior
    // when the slot plan produces no messages

    // Should have basic structure
    const hasSystemMessage = messagesEmpty.some((m) => m.role === "system");
    const hasIntent = messagesEmpty.some((m) =>
      m.content?.includes("Respect this player intent")
    );

    expect(hasSystemMessage).toBe(true);
    expect(hasIntent).toBe(true);

    // Snapshot for empty context
    expect(messagesEmpty).toMatchSnapshot("conditional-slots-empty-context");
  });

  it("should respect omitIfEmpty flag for conditional slots", () => {
    // Create a custom template with omitIfEmpty explicitly tested
    const customTemplate = {
      ...turnWriterV2Json,
      id: "conditional_omit_test",
      slots: {
        // Test slot that should be omitted when condition is false
        testSlot: {
          priority: 0,
          when: {
            type: "nonEmpty",
            ref: { source: "undefinedValue" },
          },
          plan: [
            {
              kind: "message",
              role: "user",
              content: "This should never appear",
            },
          ],
        },
      },
      layout: [
        { kind: "message", role: "system", content: "Test" },
        {
          kind: "slot",
          name: "testSlot",
          header: { role: "user", content: "Test header" },
          omitIfEmpty: true,
        },
      ],
    };

    const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(
      customTemplate
    );
    const budget = new DefaultBudgetManager({ maxTokens: 5000 });
    const messages = render(compiled, standardTurnGenCtx, budget, registry);

    // Should not contain the test header or content since condition failed
    const hasTestHeader = messages.some((m) => m.content === "Test header");
    const hasTestContent = messages.some(
      (m) => m.content === "This should never appear"
    );

    expect(hasTestHeader).toBe(false);
    expect(hasTestContent).toBe(false);

    // Should only have the system message
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: "system",
      content: "Test",
    });
  });

  it("should evaluate complex conditions correctly", () => {
    // Test various condition types on the examples slot
    const conditions = [
      // eq condition - should match empty array
      {
        type: "eq" as const,
        ref: { source: "turns", args: { limit: 1 } },
        value: [],
      },
      // nonEmpty condition - should fail on empty array
      {
        type: "nonEmpty" as const,
        ref: { source: "turns" },
      },
    ];

    for (const condition of conditions) {
      const customTemplate = {
        ...turnWriterV2Json,
        id: `condition_test_${condition.type}`,
        slots: {
          turns: turnWriterV2Json.slots.turns,
          summaries: turnWriterV2Json.slots.summaries,
          examples: {
            ...turnWriterV2Json.slots.examples,
            when: condition,
          },
        },
      };

      const compiled = compileTemplate<"fake_turn_gen", FakeTurnGenSourceSpec>(
        customTemplate
      );
      const budget = new DefaultBudgetManager({ maxTokens: 5000 });

      // Test with context that has turns
      const withTurns = render(compiled, standardTurnGenCtx, budget, registry);
      // Test with context that has no turns
      const withoutTurns = render(compiled, noTurnsCtx, budget, registry);

      if (condition.type === "eq") {
        // eq condition: examples should appear when turns is empty array
        expect(
          withTurns.some((m) =>
            m.content?.includes("Character writing examples")
          )
        ).toBe(false);
        expect(
          withoutTurns.some((m) =>
            m.content?.includes("Character writing examples")
          )
        ).toBe(true);
      } else if (condition.type === "nonEmpty") {
        // nonEmpty condition: examples should appear when turns is non-empty
        expect(
          withTurns.some((m) =>
            m.content?.includes("Character writing examples")
          )
        ).toBe(true);
        expect(
          withoutTurns.some((m) =>
            m.content?.includes("Character writing examples")
          )
        ).toBe(false);
      }
    }
  });
});
