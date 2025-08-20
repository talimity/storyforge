import { describe, expect, it } from "vitest";
import type { LoadedContext } from "../../services/context-loader";
import { buildPrompt, type PromptBuildSpec } from "./context-builder";

// Test data factory functions
function createMockLoadedContext(
  overrides: Partial<LoadedContext> = {}
): LoadedContext {
  return {
    scenario: {
      id: "scenario-1",
      name: "Test Scenario",
      description: "A test scenario",
      settings: null,
    },
    participants: [
      {
        id: "participant-1",
        role: "protagonist",
        orderIndex: 0,
        character: {
          id: "char-1",
          name: "Alice",
          description: "A brave adventurer",
          cardType: "character",
        },
      },
      {
        id: "participant-2",
        role: "antagonist",
        orderIndex: 1,
        character: {
          id: "char-2",
          name: "Bob",
          description: "A mysterious villain",
          cardType: "character",
        },
      },
    ],
    timeline: [
      {
        id: "turn-1",
        parent_turn_id: null,
        sibling_order: "m",
        depth: 1,
        prev_sibling_id: null,
        next_sibling_id: null,
      },
      {
        id: "turn-2",
        parent_turn_id: "turn-1",
        sibling_order: "n",
        depth: 0,
        prev_sibling_id: null,
        next_sibling_id: null,
      },
    ],
    contentByTurnId: {
      "turn-1": {
        presentation: "Alice enters the tavern.",
        planning: "Introduce the main character",
      },
      "turn-2": {
        presentation: "Bob appears from the shadows.",
        planning: "Reveal the antagonist",
      },
    },
    systemTemplate: "You are the narrative engine. Keep continuity.",
    ...overrides,
  };
}

function createMockPromptBuildSpec(
  overrides: Partial<PromptBuildSpec> = {}
): PromptBuildSpec {
  return {
    tokenBudget: 1000,
    layer: "presentation",
    ...overrides,
  };
}

describe("buildPrompt", () => {
  describe("input validation", () => {
    it("should throw error when timeline is empty", () => {
      const loaded = createMockLoadedContext({ timeline: [] });
      const spec = createMockPromptBuildSpec();
      expect(() => buildPrompt(loaded, spec)).toThrow(
        "Timeline is empty, cannot build prompt"
      );
    });

    it("should throw error when no participants are found", () => {
      const loaded = createMockLoadedContext({ participants: [] });
      const spec = createMockPromptBuildSpec();
      expect(() => buildPrompt(loaded, spec)).toThrow(
        "No participants found, cannot build prompt"
      );
    });

    it("should throw error when requested layer is missing from turn content", () => {
      const loaded = createMockLoadedContext({
        contentByTurnId: {
          "turn-1": { presentation: "Content 1" },
          "turn-2": { presentation: "Content 2" },
        },
      });
      const spec = createMockPromptBuildSpec({ layer: "missing-layer" });
      expect(() => buildPrompt(loaded, spec)).toThrow(
        'Turn turn-1 is missing requested layer "missing-layer"'
      );
    });
  });

  describe("system prompt generation", () => {
    it("should use provided system template", () => {
      const loaded = createMockLoadedContext({
        systemTemplate: "Custom system prompt",
      });
      const spec = createMockPromptBuildSpec();
      const result = buildPrompt(loaded, spec);

      expect(result.system).toBe("Custom system prompt");
    });

    it("should use default system template when none provided", () => {
      const loaded = createMockLoadedContext({
        systemTemplate: null,
      });
      const spec = createMockPromptBuildSpec();
      const result = buildPrompt(loaded, spec);

      expect(result.system).toBe(
        "You are the narrative engine. Keep continuity."
      );
    });

    it("should use default system template when undefined", () => {
      const loaded = createMockLoadedContext({
        systemTemplate: undefined,
      });
      const spec = createMockPromptBuildSpec();
      const result = buildPrompt(loaded, spec);

      expect(result.system).toBe(
        "You are the narrative engine. Keep continuity."
      );
    });
  });

  describe("character descriptions", () => {
    it("should include character descriptions as system messages", () => {
      const loaded = createMockLoadedContext();
      const spec = createMockPromptBuildSpec();
      const result = buildPrompt(loaded, spec);

      const characterMessages = result.messages.filter(
        (m) => m.role === "system" && m.name
      );
      expect(characterMessages).toHaveLength(2);

      expect(characterMessages[0]).toEqual({
        role: "system",
        name: "Alice",
        content: "A brave adventurer",
      });

      expect(characterMessages[1]).toEqual({
        role: "system",
        name: "Bob",
        content: "A mysterious villain",
      });
    });
  });

  describe("timeline processing", () => {
    it("should convert timeline to narrator messages using specified layer", () => {
      const loaded = createMockLoadedContext();
      const spec = createMockPromptBuildSpec({ layer: "presentation" });
      const result = buildPrompt(loaded, spec);

      const timelineMessages = result.messages.filter(
        (m) => m.role === "narrator"
      );
      expect(timelineMessages).toHaveLength(2);

      expect(timelineMessages[0]).toEqual({
        role: "narrator",
        content: "Alice enters the tavern.",
        turnId: "turn-1",
      });

      expect(timelineMessages[1]).toEqual({
        role: "narrator",
        content: "Bob appears from the shadows.",
        turnId: "turn-2",
      });
    });

    it("should use different layer when specified", () => {
      const loaded = createMockLoadedContext();
      const spec = createMockPromptBuildSpec({ layer: "planning" });
      const result = buildPrompt(loaded, spec);

      const timelineMessages = result.messages.filter(
        (m) => m.role === "narrator"
      );
      expect(timelineMessages).toHaveLength(2);

      expect(timelineMessages[0].content).toBe("Introduce the main character");
      expect(timelineMessages[1].content).toBe("Reveal the antagonist");
    });
  });

  describe("token budget management", () => {
    it("should respect token budget and exclude messages that exceed it", () => {
      const loaded = createMockLoadedContext({
        participants: [
          {
            id: "participant-1",
            role: "protagonist",
            orderIndex: 0,
            character: {
              id: "char-1",
              name: "Alice",
              description:
                "This is a very long character description with many words that should exceed the small token budget we set for this test case", // Long description
              cardType: "character",
            },
          },
        ],
        timeline: [
          {
            id: "turn-1",
            parent_turn_id: null,
            sibling_order: "m",
            depth: 0,
            prev_sibling_id: null,
            next_sibling_id: null,
          },
        ],
        contentByTurnId: {
          "turn-1": {
            presentation:
              "This is also a very long turn content with many words that should exceed our small budget",
          },
        },
      });
      const spec = createMockPromptBuildSpec({ tokenBudget: 5 });
      const result = buildPrompt(loaded, spec);

      // Should have very few messages due to budget constraint
      expect(result.messages.length).toBeLessThanOrEqual(1);
    });

    it("should include all messages when budget is sufficient", () => {
      const loaded = createMockLoadedContext();
      const spec = createMockPromptBuildSpec({ tokenBudget: 10000 });
      const result = buildPrompt(loaded, spec);

      // Should have character descriptions + timeline messages
      expect(result.messages).toHaveLength(4); // 2 characters + 2 timeline messages
    });

    it("should stop adding messages when budget is exceeded", () => {
      const loaded = createMockLoadedContext({
        participants: [
          {
            id: "participant-1",
            role: "protagonist",
            orderIndex: 0,
            character: {
              id: "char-1",
              name: "Alice",
              description: "Short", // Fits in budget
              cardType: "character",
            },
          },
          {
            id: "participant-2",
            role: "antagonist",
            orderIndex: 1,
            character: {
              id: "char-2",
              name: "Bob",
              description:
                "This is a very very very very very very very long character description with many many many words that should definitely exceed our limited token budget and cause the system to stop adding messages", // Very long, won't fit
              cardType: "character",
            },
          },
        ],
      });
      const spec = createMockPromptBuildSpec({ tokenBudget: 5 }); // Very limited budget
      const result = buildPrompt(loaded, spec);

      // Should stop before including the very long description
      const characterMessages = result.messages.filter(
        (m) => m.role === "system" && m.name
      );
      expect(characterMessages.length).toBe(1); // Only Alice should fit in budget
      expect(characterMessages[0].name).toBe("Alice");
    });
  });

  describe("message ordering", () => {
    it("should order messages with character descriptions first, then timeline", () => {
      const loaded = createMockLoadedContext();
      const spec = createMockPromptBuildSpec();
      const result = buildPrompt(loaded, spec);

      expect(result.messages).toHaveLength(4);

      // First two should be character descriptions (system messages with names)
      expect(result.messages[0].role).toBe("system");
      expect(result.messages[0].name).toBe("Alice");
      expect(result.messages[1].role).toBe("system");
      expect(result.messages[1].name).toBe("Bob");

      // Next two should be timeline messages (narrator messages)
      expect(result.messages[2].role).toBe("narrator");
      expect(result.messages[2].turnId).toBe("turn-1");
      expect(result.messages[3].role).toBe("narrator");
      expect(result.messages[3].turnId).toBe("turn-2");
    });
  });

  describe("metadata generation", () => {
    it("should include used turn IDs in metadata", () => {
      const loaded = createMockLoadedContext();
      const spec = createMockPromptBuildSpec();
      const result = buildPrompt(loaded, spec);

      expect(result.meta.usedTurns).toEqual(["turn-1", "turn-2"]);
    });

    it("should only include turn IDs that were actually used due to budget", () => {
      const loaded = createMockLoadedContext({
        // set empty descriptions to simplify
        participants: [
          {
            id: "participant-1",
            role: "protagonist",
            orderIndex: 0,
            character: {
              id: "char-1",
              name: "Alice",
              description: "",
              cardType: "character",
            },
          },
        ],
        timeline: [
          {
            id: "turn-1",
            parent_turn_id: null,
            sibling_order: "m",
            depth: 1,
            prev_sibling_id: null,
            next_sibling_id: null,
          },
          {
            id: "turn-2",
            parent_turn_id: "turn-1",
            sibling_order: "n",
            depth: 0,
            prev_sibling_id: null,
            next_sibling_id: null,
          },
        ],
        contentByTurnId: {
          "turn-1": { presentation: "Short content" },
          "turn-2": {
            presentation:
              "This is a very very very very very very very long turn content with many many many words that should definitely exceed our small token budget and not be included in the final result",
          }, // Very long content
        },
      });
      const spec = createMockPromptBuildSpec({ tokenBudget: 5 }); // Very small budget
      const result = buildPrompt(loaded, spec);

      // Should not include turn-2 due to budget constraint
      expect(result.meta.usedTurns).not.toContain("turn-2");
    });
  });

  describe("edge cases", () => {
    it("should handle single turn in timeline", () => {
      const loaded = createMockLoadedContext({
        timeline: [
          {
            id: "turn-1",
            parent_turn_id: null,
            sibling_order: "m",
            depth: 0,
            prev_sibling_id: null,
            next_sibling_id: null,
          },
        ],
        contentByTurnId: {
          "turn-1": { presentation: "Single turn content" },
        },
      });
      const spec = createMockPromptBuildSpec();
      const result = buildPrompt(loaded, spec);

      const timelineMessages = result.messages.filter(
        (m) => m.role === "narrator"
      );
      expect(timelineMessages).toHaveLength(1);
      expect(timelineMessages[0].content).toBe("Single turn content");
      expect(result.meta.usedTurns).toEqual(["turn-1"]);
    });

    it("should handle zero token budget gracefully", () => {
      const loaded = createMockLoadedContext();
      const spec = createMockPromptBuildSpec({ tokenBudget: 0 });
      const result = buildPrompt(loaded, spec);

      expect(result.messages).toHaveLength(0);
      expect(result.meta.usedTurns).toEqual([]);
      expect(result.system).toBe(
        "You are the narrative engine. Keep continuity."
      );
    });
  });
});
