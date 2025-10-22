import { describe, expect, it } from "vitest";
import { makeRegistry } from "./source-registry.js";

describe("makeRegistry", () => {
  const mockTurnGenCtx = {
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
    stepOutputs: { planner: { plan: "Talk about the weather" } },
    globals: { worldName: "Fantasyland" },
    lorebooks: [],
  };

  const mockWritingAssistantCtx = {
    userText: "Please help me write better",
    examples: ["Example 1", "Example 2"],
    stylePrefs: { tone: "formal" },
    globals: { language: "en" },
  };

  describe("basic functionality", () => {
    it("should create a registry and resolve known sources", () => {
      const registry = makeRegistry<typeof mockTurnGenCtx, any>({
        turns: (_ref, ctx) => ctx.turns,
        characters: (_ref, ctx) => ctx.characters,
        intent: (_ref, ctx) => ctx.currentIntent,
      });

      const turnsRef = { source: "turns" };
      const charactersRef = { source: "characters" };
      const intentRef = { source: "intent" };

      expect(registry.resolve(turnsRef, mockTurnGenCtx)).toBe(mockTurnGenCtx.turns);
      expect(registry.resolve(charactersRef, mockTurnGenCtx)).toBe(mockTurnGenCtx.characters);
      expect(registry.resolve(intentRef, mockTurnGenCtx)).toBe(mockTurnGenCtx.currentIntent);
    });

    it("should return undefined for unknown sources", () => {
      const registry = makeRegistry<typeof mockTurnGenCtx, any>({
        turns: (_ref, ctx) => ctx.turns,
      });

      const unknownRef = { source: "nonexistent" };
      expect(registry.resolve(unknownRef, mockTurnGenCtx)).toBeUndefined();
    });

    it("should handle empty registry", () => {
      const registry = makeRegistry<typeof mockTurnGenCtx, any>({});

      const ref = { source: "anything" };
      expect(registry.resolve(ref, mockTurnGenCtx)).toBeUndefined();
    });
  });

  describe("args passing", () => {
    it("should pass args to source handlers", () => {
      const registry = makeRegistry<
        typeof mockTurnGenCtx,
        {
          filteredTurns: {
            args: { limit?: number };
            out: typeof mockTurnGenCtx.turns;
          };
          characterById: {
            args: { id: string };
            out: (typeof mockTurnGenCtx.characters)[0] | undefined;
          };
        }
      >({
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

      const limitedTurnsRef = {
        source: "filteredTurns" as const,
        args: { limit: 1 },
      };
      const result = registry.resolve(
        limitedTurnsRef,
        mockTurnGenCtx
      ) as typeof mockTurnGenCtx.turns;
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockTurnGenCtx.turns[0]);

      const characterRef = {
        source: "characterById" as const,
        args: { id: "alice" },
      };
      const character = registry.resolve(characterRef, mockTurnGenCtx);
      expect(character).toBe(mockTurnGenCtx.characters[0]);
    });

    it("should handle undefined args", () => {
      const registry = makeRegistry<
        typeof mockTurnGenCtx,
        {
          turns: { args: undefined; out: typeof mockTurnGenCtx.turns };
        }
      >({
        turns: (ref, ctx) => {
          expect(ref.args).toBeUndefined();
          return ctx.turns;
        },
      });

      const ref = { source: "turns" as const };
      const result = registry.resolve(ref, mockTurnGenCtx);
      expect(result).toBe(mockTurnGenCtx.turns);
    });
  });

  describe("list() method", () => {
    it("should return all registered source names", () => {
      const registry = makeRegistry<typeof mockTurnGenCtx, any>({
        turns: (_ref, ctx) => ctx.turns,
        characters: (_ref, ctx) => ctx.characters,
        intent: (_ref, ctx) => ctx.currentIntent,
      });

      const sources = registry.list?.();
      expect(sources).toEqual(["turns", "characters", "intent"]);
    });

    it("should return empty array for empty registry", () => {
      const registry = makeRegistry<typeof mockTurnGenCtx, any>({});

      const sources = registry.list?.();
      expect(sources).toEqual([]);
    });

    it("should include dynamically added sources", () => {
      const handlers: Record<string, any> = {
        turns: (_ref: unknown, ctx: any) => ctx.turns,
      };

      const registry = makeRegistry<typeof mockTurnGenCtx, any>(handlers);

      // Simulate adding a source (though this wouldn't normally happen)
      handlers.characters = (_ref: unknown, ctx: any) => ctx.characters;

      // list() should reflect the current state
      const sources = registry.list?.();
      expect(sources).toEqual(["turns", "characters"]);
    });
  });

  describe("different task types", () => {
    it("should work with writing assistant context", () => {
      const registry = makeRegistry<typeof mockWritingAssistantCtx, any>({
        userText: (_ref, ctx) => ctx.userText,
        examples: (_ref, ctx) => ctx.examples,
        stylePrefs: (_ref, ctx) => ctx.stylePrefs,
      });

      const userTextRef = { source: "userText" };
      const examplesRef = { source: "examples" };

      expect(registry.resolve(userTextRef, mockWritingAssistantCtx)).toBe(
        "Please help me write better"
      );
      expect(registry.resolve(examplesRef, mockWritingAssistantCtx)).toBe(
        mockWritingAssistantCtx.examples
      );
    });

    it("should handle complex nested data access", () => {
      const registry = makeRegistry<
        typeof mockTurnGenCtx,
        {
          stepOutput: { args: { key: string }; out: unknown };
          globalValue: { args: { key: string }; out: unknown };
        }
      >({
        stepOutput: (ref, ctx) => {
          const args = ref.args as { key: string };
          const stepOutputs: any = ctx.stepOutputs || {};
          return stepOutputs[args.key];
        },
        globalValue: (ref, ctx) => {
          const args = ref.args as { key: string };
          const globals: any = ctx.globals || {};
          return globals[args.key];
        },
      });

      const stepOutputRef = {
        source: "stepOutput" as const,
        args: { key: "planner" },
      };
      const globalRef = {
        source: "globalValue" as const,
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
      const registry = makeRegistry<typeof mockTurnGenCtx, any>({
        errorSource: () => {
          throw new Error("Source handler error");
        },
        goodSource: (_ref, ctx) => ctx.turns,
      });

      const errorRef = { source: "errorSource" };
      const goodRef = { source: "goodSource" };

      // The error should propagate
      expect(() => registry.resolve(errorRef, mockTurnGenCtx)).toThrow("Source handler error");

      // Other sources should still work
      expect(registry.resolve(goodRef, mockTurnGenCtx)).toBe(mockTurnGenCtx.turns);
    });

    it("should handle source handler returning undefined", () => {
      const registry = makeRegistry<typeof mockTurnGenCtx, any>({
        undefinedSource: () => undefined,
        nullSource: () => null,
      });

      const undefinedRef = { source: "undefinedSource" };
      const nullRef = { source: "nullSource" };

      expect(registry.resolve(undefinedRef, mockTurnGenCtx)).toBeUndefined();
      expect(registry.resolve(nullRef, mockTurnGenCtx)).toBeNull();
    });
  });
});
