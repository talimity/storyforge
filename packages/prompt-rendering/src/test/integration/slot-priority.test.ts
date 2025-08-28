import { describe, expect, it } from "vitest";
import { DefaultBudgetManager } from "../../budget-manager";
import { compileTemplate } from "../../compiler";
import { render } from "../../renderer";
import { parseTemplate } from "../../schemas";
import {
  noTurnsCtx,
  standardTurnGenCtx,
} from "../fixtures/contexts/turn-generation-contexts";
import { makeSpecTurnGenerationRegistry } from "../fixtures/registries/turn-generation-registry";
import turnWriterV2Json from "../fixtures/templates/spec/tpl_turn_writer_v2.json";

describe("Slot Priority vs Layout Order", () => {
  const registry = makeSpecTurnGenerationRegistry();

  it("should fill slots in priority order but display in layout order", () => {
    // Parse and compile the template
    const template = parseTemplate(turnWriterV2Json);
    const compiled = compileTemplate(template);

    // Create budget manager with enough tokens for all content
    const budget = new DefaultBudgetManager({ maxTokens: 5000 });

    // Use context that will trigger examples slot (no turns)
    const messages = render(compiled, noTurnsCtx, budget, registry);

    // Verify the structure matches expected layout order (not fill order)
    // With noTurnsCtx: summaries → examples (no turns since array is empty)
    // Fill priority: turns (0) → summaries (1) → examples (2), but turns are empty so summaries → examples
    // Layout order: system → user intent → summaries → turns (empty/omitted) → examples → final instruction

    // Find key message indices
    const systemMsgIndex = messages.findIndex((m) => m.role === "system");
    const intentMsgIndex = messages.findIndex((m) =>
      m.content?.includes("Respect this player intent")
    );
    const earlierEventsIndex = messages.findIndex(
      (m) => m.content === "Earlier events:"
    );

    const examplesIndex = messages.findIndex(
      (m) => m.content === "Character writing examples:"
    );
    const finalInstructionIndex = messages.findIndex((m) =>
      m.content?.includes("Write the next turn")
    );

    // Verify basic layout order
    expect(systemMsgIndex).toBeLessThan(intentMsgIndex);
    expect(intentMsgIndex).toBeLessThan(finalInstructionIndex);

    // Verify summaries appear if present
    if (earlierEventsIndex !== -1) {
      expect(intentMsgIndex).toBeLessThan(earlierEventsIndex);
      expect(earlierEventsIndex).toBeLessThan(finalInstructionIndex);
    }

    // Verify examples appear (should be present due to empty turns)
    expect(examplesIndex).toBeGreaterThan(-1);
    expect(examplesIndex).toBeLessThan(finalInstructionIndex);

    // Should have summaries content
    expect(messages).toContainEqual(
      expect.objectContaining({
        role: "user",
        content: expect.stringContaining("Ch"),
      })
    );

    // Should have examples content but no turn content
    expect(messages).toContainEqual(
      expect.objectContaining({
        role: "user",
        content: expect.stringContaining(" — Example:"),
      })
    );

    // Snapshot test for complete structure
    expect(messages).toMatchSnapshot("slot-priority-layout-order");
  });

  it("should respect fill priority with limited budget", () => {
    const template = parseTemplate(turnWriterV2Json);
    const compiled = compileTemplate(template);

    // Create a budget that allows turns (priority 0) but not summaries (priority 1)
    const budget = new DefaultBudgetManager({ maxTokens: 1200 });

    const messages = render(compiled, standardTurnGenCtx, budget, registry);

    // Should have turns content but possibly limited summaries
    const hasRecentTurns = messages.some((m) =>
      m.content?.includes("Recent scene turns")
    );
    const hasTurnContent = messages.some((m) => m.content?.includes("["));

    expect(hasRecentTurns || hasTurnContent).toBe(true);

    // Snapshot for budget-constrained rendering
    expect(messages).toMatchSnapshot("slot-priority-budget-constrained");
  });

  it("should maintain deterministic order with identical inputs", () => {
    const template = parseTemplate(turnWriterV2Json);
    const compiled = compileTemplate(template);

    // Render twice with identical inputs
    const budget1 = new DefaultBudgetManager({ maxTokens: 3000 });
    const budget2 = new DefaultBudgetManager({ maxTokens: 3000 });

    const messages1 = render(compiled, standardTurnGenCtx, budget1, registry);
    const messages2 = render(compiled, standardTurnGenCtx, budget2, registry);

    // Should be identical
    expect(messages1).toEqual(messages2);
  });
});
