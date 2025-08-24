import { describe, expect, it } from "vitest";
import { makeRegistry } from "./source-registry";
import type { DataRef, TurnGenCtx, WritingAssistantCtx } from "./types";

describe("makeRegistry", () => {
  const mockTurnGenCtx: TurnGenCtx = {
    turns: [
      {
        turnNo: 1,
        authorName: "Alice",
        authorType: "character",
        content: "Hello",
      },
      {
        turnNo: 2,
        authorName: "Bob",
        authorType: "character",
        content: "Hi there",
      },
    ],
    chapterSummaries: [{ chapterNo: 1, summary: "The heroes meet" }],
    characters: [
      { id: "alice", name: "Alice", description: "A brave warrior" },
      { id: "bob", name: "Bob", description: "A wise mage" },
    ],
    currentIntent: { description: "Characters have a conversation" },
    stepInputs: { planner: { plan: "Talk about the weather" } },
    globals: { worldName: "Fantasyland" },
  };

  const mockWritingAssistantCtx: WritingAssistantCtx = {
    userText: "Please help me write better",
    examples: ["Example 1", "Example 2"],
    stylePrefs: { tone: "formal" },
    globals: { language: "en" },
  };

  describe("basic functionality", () => {
    it("should create a registry and resolve known sources", () => {
      const registry = makeRegistry<"turn_generation">({
        turns: (_ref, ctx) => ctx.turns,
        characters: (_ref, ctx) => ctx.characters,
        intent: (_ref, ctx) => ctx.currentIntent,
      });

      const turnsRef: DataRef = { source: "turns" };
      const charactersRef: DataRef = { source: "characters" };
      const intentRef: DataRef = { source: "intent" };

      expect(registry.resolve(turnsRef, mockTurnGenCtx)).toBe(
        mockTurnGenCtx.turns
      );
      expect(registry.resolve(charactersRef, mockTurnGenCtx)).toBe(
        mockTurnGenCtx.characters
      );
      expect(registry.resolve(intentRef, mockTurnGenCtx)).toBe(
        mockTurnGenCtx.currentIntent
      );
    });

    it("should return undefined for unknown sources", () => {
      const registry = makeRegistry<"turn_generation">({
        turns: (_ref, ctx) => ctx.turns,
      });

      const unknownRef: DataRef = { source: "nonexistent" };
      expect(registry.resolve(unknownRef, mockTurnGenCtx)).toBeUndefined();
    });

    it("should handle empty registry", () => {
      const registry = makeRegistry<"turn_generation">({});

      const ref: DataRef = { source: "anything" };
      expect(registry.resolve(ref, mockTurnGenCtx)).toBeUndefined();
    });
  });

  describe("args passing", () => {
    it("should pass args to source handlers", () => {
      const registry = makeRegistry<"turn_generation">({
        filteredTurns: (ref, ctx) => {
          const args = ref.args as { limit?: number };
          const limit = args?.limit ?? ctx.turns.length;
          return ctx.turns.slice(0, limit);
        },
        characterById: (ref, ctx) => {
          const args = ref.args as { id: string };
          return ctx.characters.find((char) => char.id === args.id);
        },
      });

      const limitedTurnsRef: DataRef = {
        source: "filteredTurns",
        args: { limit: 1 },
      };
      const result = registry.resolve(
        limitedTurnsRef,
        mockTurnGenCtx
      ) as typeof mockTurnGenCtx.turns;
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockTurnGenCtx.turns[0]);

      const characterRef: DataRef = {
        source: "characterById",
        args: { id: "alice" },
      };
      const character = registry.resolve(characterRef, mockTurnGenCtx);
      expect(character).toBe(mockTurnGenCtx.characters[0]);
    });

    it("should handle undefined args", () => {
      const registry = makeRegistry<"turn_generation">({
        turns: (ref, ctx) => {
          expect(ref.args).toBeUndefined();
          return ctx.turns;
        },
      });

      const ref: DataRef = { source: "turns" };
      const result = registry.resolve(ref, mockTurnGenCtx);
      expect(result).toBe(mockTurnGenCtx.turns);
    });
  });

  describe("list() method", () => {
    it("should return all registered source names", () => {
      const registry = makeRegistry<"turn_generation">({
        turns: (_ref, ctx) => ctx.turns,
        characters: (_ref, ctx) => ctx.characters,
        intent: (_ref, ctx) => ctx.currentIntent,
      });

      const sources = registry.list?.();
      expect(sources).toEqual(["turns", "characters", "intent"]);
    });

    it("should return empty array for empty registry", () => {
      const registry = makeRegistry<"turn_generation">({});

      const sources = registry.list?.();
      expect(sources).toEqual([]);
    });

    it("should include dynamically added sources", () => {
      const handlers: Record<string, any> = {
        turns: (_ref: DataRef, ctx: any) => ctx.turns,
      };

      const registry = makeRegistry<"turn_generation">(handlers);

      // Simulate adding a source (though this wouldn't normally happen)
      handlers.characters = (_ref: DataRef, ctx: any) => ctx.characters;

      // list() should reflect the current state
      const sources = registry.list?.();
      expect(sources).toEqual(["turns", "characters"]);
    });
  });

  describe("different task types", () => {
    it("should work with writing assistant context", () => {
      const registry = makeRegistry<"writing_assistant">({
        userText: (_ref, ctx) => ctx.userText,
        examples: (_ref, ctx) => ctx.examples,
        stylePrefs: (_ref, ctx) => ctx.stylePrefs,
      });

      const userTextRef: DataRef = { source: "userText" };
      const examplesRef: DataRef = { source: "examples" };

      expect(registry.resolve(userTextRef, mockWritingAssistantCtx)).toBe(
        "Please help me write better"
      );
      expect(registry.resolve(examplesRef, mockWritingAssistantCtx)).toBe(
        mockWritingAssistantCtx.examples
      );
    });

    it("should handle complex nested data access", () => {
      const registry = makeRegistry<"turn_generation">({
        stepOutput: (ref, ctx) => {
          const args = ref.args as { key: string };
          const stepInputs = ctx.stepInputs || {};
          return stepInputs[args.key];
        },
        globalValue: (ref, ctx) => {
          const args = ref.args as { key: string };
          const globals = ctx.globals || {};
          return globals[args.key];
        },
      });

      const stepOutputRef: DataRef = {
        source: "stepOutput",
        args: { key: "planner" },
      };
      const globalRef: DataRef = {
        source: "globalValue",
        args: { key: "worldName" },
      };

      expect(registry.resolve(stepOutputRef, mockTurnGenCtx)).toEqual({
        plan: "Talk about the weather",
      });
      expect(registry.resolve(globalRef, mockTurnGenCtx)).toBe("Fantasyland");
    });
  });

  describe("error handling", () => {
    it("should handle source handler throwing errors", () => {
      const registry = makeRegistry<"turn_generation">({
        errorSource: () => {
          throw new Error("Source handler error");
        },
        goodSource: (_ref, ctx) => ctx.turns,
      });

      const errorRef: DataRef = { source: "errorSource" };
      const goodRef: DataRef = { source: "goodSource" };

      // The error should propagate
      expect(() => registry.resolve(errorRef, mockTurnGenCtx)).toThrow(
        "Source handler error"
      );

      // Other sources should still work
      expect(registry.resolve(goodRef, mockTurnGenCtx)).toBe(
        mockTurnGenCtx.turns
      );
    });

    it("should handle source handler returning undefined", () => {
      const registry = makeRegistry<"turn_generation">({
        undefinedSource: () => undefined,
        nullSource: () => null,
      });

      const undefinedRef: DataRef = { source: "undefinedSource" };
      const nullRef: DataRef = { source: "nullSource" };

      expect(registry.resolve(undefinedRef, mockTurnGenCtx)).toBeUndefined();
      expect(registry.resolve(nullRef, mockTurnGenCtx)).toBeNull();
    });
  });
});
