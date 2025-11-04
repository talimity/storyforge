import { describe, expect, it, vi } from "vitest";
import { evaluateCondition } from "./condition-evaluator.js";
import { makeRegistry } from "./source-registry.js";
import type { ConditionRef } from "./types.js";

describe("evaluateCondition", () => {
  const mockCtx = {
    turns: [
      {
        turnNo: 1,
        authorName: "Alice",
        authorType: "character",
        content: "Hello",
      },
      { turnNo: 2, authorName: "Bob", authorType: "character", content: "Hi" },
    ],
    chapterSummaries: [],
    chapters: [
      { chapterNumber: 1, title: "Intro", breakEventId: "ev1", breakTurnId: "turn-1" },
      { chapterNumber: 2, title: "Continuation", breakEventId: "ev2", breakTurnId: "turn-2" },
    ],
    characters: [{ id: "alice", name: "Alice", description: "A warrior" }],
    currentIntent: { description: "Test intent" },
    stepOutputs: { planner: { plan: "Talk about weather" } },
    globals: { worldName: "Fantasyland" },
  };

  const registry = makeRegistry<typeof mockCtx, any>({
    turns: (_ref, ctx) => ctx.turns,
    emptyArray: () => [],
    characters: (_ref, ctx) => ctx.characters,
    emptyChapters: (_ref, ctx) => ctx.chapterSummaries,
    intent: (_ref, ctx) => ctx.currentIntent?.description,
    nullValue: () => null,
    undefinedValue: () => undefined,
    zeroNumber: () => 0,
    positiveNumber: () => 42,
    negativeNumber: () => -10,
    emptyString: () => "",
    nonEmptyString: () => "hello",
    truthyObject: () => ({ id: 1 }),
    falsyBoolean: () => false,
    truthyBoolean: () => true,
    nanValue: () => Number.NaN,
    infinityValue: () => Number.POSITIVE_INFINITY,
    objectA: () => ({ name: "Alice", age: 25 }),
    objectB: () => ({ name: "Alice", age: 25 }),
    objectC: () => ({ name: "Bob", age: 30 }),
    arrayA: () => [1, 2, 3],
    arrayB: () => [1, 2, 3],
    arrayC: () => [3, 2, 1],
  });

  describe("exists condition", () => {
    it("should return true for values that exist", () => {
      const conditions: ConditionRef[] = [
        { type: "exists", ref: { source: "turns" } },
        { type: "exists", ref: { source: "emptyArray" } },
        { type: "exists", ref: { source: "characters" } },
        { type: "exists", ref: { source: "zeroNumber" } },
        { type: "exists", ref: { source: "emptyString" } },
        { type: "exists", ref: { source: "falsyBoolean" } },
        { type: "exists", ref: { source: "truthyObject" } },
      ];

      for (const condition of conditions) {
        expect(evaluateCondition(condition, mockCtx, registry)).toBe(true);
      }
    });

    it("should return false for null and undefined values", () => {
      const conditions: ConditionRef[] = [
        { type: "exists", ref: { source: "nullValue" } },
        { type: "exists", ref: { source: "undefinedValue" } },
        { type: "exists", ref: { source: "unknownSource" } },
      ];

      for (const condition of conditions) {
        expect(evaluateCondition(condition, mockCtx, registry)).toBe(false);
      }
    });
  });

  describe("nonEmpty condition", () => {
    it("should return true for non-empty arrays", () => {
      const condition: ConditionRef = {
        type: "nonEmpty",
        ref: { source: "turns" },
      };
      expect(evaluateCondition(condition, mockCtx, registry)).toBe(true);

      const condition2: ConditionRef = {
        type: "nonEmpty",
        ref: { source: "characters" },
      };
      expect(evaluateCondition(condition2, mockCtx, registry)).toBe(true);
    });

    it("should return false for empty arrays", () => {
      const condition: ConditionRef = {
        type: "nonEmpty",
        ref: { source: "emptyArray" },
      };
      expect(evaluateCondition(condition, mockCtx, registry)).toBe(false);

      const condition2: ConditionRef = {
        type: "nonEmpty",
        ref: { source: "emptyChapters" },
      };
      expect(evaluateCondition(condition2, mockCtx, registry)).toBe(false);
    });

    it("should return true for non-empty strings", () => {
      const condition: ConditionRef = {
        type: "nonEmpty",
        ref: { source: "nonEmptyString" },
      };
      expect(evaluateCondition(condition, mockCtx, registry)).toBe(true);

      const condition2: ConditionRef = {
        type: "nonEmpty",
        ref: { source: "intent" },
      };
      expect(evaluateCondition(condition2, mockCtx, registry)).toBe(true);
    });

    it("should return false for empty strings", () => {
      const condition: ConditionRef = {
        type: "nonEmpty",
        ref: { source: "emptyString" },
      };
      expect(evaluateCondition(condition, mockCtx, registry)).toBe(false);
    });

    it("should return falsy for other values", () => {
      const falsyConditions: ConditionRef[] = [
        { type: "nonEmpty", ref: { source: "positiveNumber" } },
        { type: "nonEmpty", ref: { source: "truthyObject" } },
        { type: "nonEmpty", ref: { source: "truthyBoolean" } },
        { type: "nonEmpty", ref: { source: "infinityValue" } },
        { type: "nonEmpty", ref: { source: "zeroNumber" } },
        { type: "nonEmpty", ref: { source: "falsyBoolean" } },
        { type: "nonEmpty", ref: { source: "nullValue" } },
        { type: "nonEmpty", ref: { source: "undefinedValue" } },
      ];

      for (const condition of falsyConditions) {
        expect(evaluateCondition(condition, mockCtx, registry)).toBe(false);
      }
    });
  });

  describe("eq condition", () => {
    it("should return true for equal primitives", () => {
      const conditions: { condition: ConditionRef; expected: boolean }[] = [
        {
          condition: { type: "eq", ref: { source: "zeroNumber" }, value: 0 },
          expected: true,
        },
        {
          condition: {
            type: "eq",
            ref: { source: "positiveNumber" },
            value: 42,
          },
          expected: true,
        },
        {
          condition: { type: "eq", ref: { source: "emptyString" }, value: "" },
          expected: true,
        },
        {
          condition: {
            type: "eq",
            ref: { source: "nonEmptyString" },
            value: "hello",
          },
          expected: true,
        },
        {
          condition: {
            type: "eq",
            ref: { source: "truthyBoolean" },
            value: true,
          },
          expected: true,
        },
        {
          condition: {
            type: "eq",
            ref: { source: "falsyBoolean" },
            value: false,
          },
          expected: true,
        },
        {
          condition: { type: "eq", ref: { source: "nullValue" }, value: null },
          expected: true,
        },
        {
          condition: {
            type: "eq",
            ref: { source: "undefinedValue" },
            value: undefined,
          },
          expected: true,
        },
      ];

      for (const { condition, expected } of conditions) {
        expect(evaluateCondition(condition, mockCtx, registry)).toBe(expected);
      }
    });

    it("should return false for unequal primitives", () => {
      const conditions: ConditionRef[] = [
        { type: "eq", ref: { source: "positiveNumber" }, value: 43 },
        { type: "eq", ref: { source: "nonEmptyString" }, value: "world" },
        { type: "eq", ref: { source: "truthyBoolean" }, value: false },
        { type: "eq", ref: { source: "zeroNumber" }, value: 1 },
      ];

      for (const condition of conditions) {
        expect(evaluateCondition(condition, mockCtx, registry)).toBe(false);
      }
    });

    it("should compare objects using JSON.stringify", () => {
      // Equal objects
      const equalCondition: ConditionRef = {
        type: "eq",
        ref: { source: "objectA" },
        value: { name: "Alice", age: 25 },
      };
      expect(evaluateCondition(equalCondition, mockCtx, registry)).toBe(true);

      // Different objects
      const differentCondition: ConditionRef = {
        type: "eq",
        ref: { source: "objectA" },
        value: { name: "Bob", age: 30 },
      };
      expect(evaluateCondition(differentCondition, mockCtx, registry)).toBe(false);

      // Equal arrays
      const arrayCondition: ConditionRef = {
        type: "eq",
        ref: { source: "arrayA" },
        value: [1, 2, 3],
      };
      expect(evaluateCondition(arrayCondition, mockCtx, registry)).toBe(true);

      // Different arrays
      const differentArrayCondition: ConditionRef = {
        type: "eq",
        ref: { source: "arrayA" },
        value: [3, 2, 1],
      };
      expect(evaluateCondition(differentArrayCondition, mockCtx, registry)).toBe(false);
    });
  });

  describe("neq condition", () => {
    it("should return false for equal values", () => {
      const conditions: ConditionRef[] = [
        { type: "neq", ref: { source: "positiveNumber" }, value: 42 },
        { type: "neq", ref: { source: "nonEmptyString" }, value: "hello" },
        { type: "neq", ref: { source: "truthyBoolean" }, value: true },
        {
          type: "neq",
          ref: { source: "objectA" },
          value: { name: "Alice", age: 25 },
        },
        { type: "neq", ref: { source: "arrayA" }, value: [1, 2, 3] },
      ];

      for (const condition of conditions) {
        expect(evaluateCondition(condition, mockCtx, registry)).toBe(false);
      }
    });

    it("should return true for unequal values", () => {
      const conditions: ConditionRef[] = [
        { type: "neq", ref: { source: "positiveNumber" }, value: 43 },
        { type: "neq", ref: { source: "nonEmptyString" }, value: "world" },
        { type: "neq", ref: { source: "truthyBoolean" }, value: false },
        {
          type: "neq",
          ref: { source: "objectA" },
          value: { name: "Bob", age: 30 },
        },
        { type: "neq", ref: { source: "arrayA" }, value: [3, 2, 1] },
      ];

      for (const condition of conditions) {
        expect(evaluateCondition(condition, mockCtx, registry)).toBe(true);
      }
    });
  });

  describe("gt condition", () => {
    it("should return true when resolved value is greater", () => {
      const conditions: ConditionRef[] = [
        { type: "gt", ref: { source: "positiveNumber" }, value: 41 },
        { type: "gt", ref: { source: "positiveNumber" }, value: 0 },
        { type: "gt", ref: { source: "zeroNumber" }, value: -1 },
        { type: "gt", ref: { source: "negativeNumber" }, value: -20 },
      ];

      for (const condition of conditions) {
        expect(evaluateCondition(condition, mockCtx, registry)).toBe(true);
      }
    });

    it("should return false when resolved value is less or equal", () => {
      const conditions: ConditionRef[] = [
        { type: "gt", ref: { source: "positiveNumber" }, value: 42 }, // equal
        { type: "gt", ref: { source: "positiveNumber" }, value: 43 }, // less
        { type: "gt", ref: { source: "zeroNumber" }, value: 0 }, // equal
        { type: "gt", ref: { source: "zeroNumber" }, value: 1 }, // less
        { type: "gt", ref: { source: "negativeNumber" }, value: -10 }, // equal
        { type: "gt", ref: { source: "negativeNumber" }, value: 0 }, // less
      ];

      for (const condition of conditions) {
        expect(evaluateCondition(condition, mockCtx, registry)).toBe(false);
      }
    });

    it("should return false for non-number values", () => {
      const conditions: ConditionRef[] = [
        { type: "gt", ref: { source: "nonEmptyString" }, value: 10 },
        { type: "gt", ref: { source: "truthyObject" }, value: 5 },
        { type: "gt", ref: { source: "nullValue" }, value: 0 },
        { type: "gt", ref: { source: "undefinedValue" }, value: 0 },
        { type: "gt", ref: { source: "nanValue" }, value: 0 },
        { type: "gt", ref: { source: "positiveNumber" }, value: "42" }, // string comparison value
      ];

      for (const condition of conditions) {
        expect(evaluateCondition(condition, mockCtx, registry)).toBe(false);
      }
    });

    it("should handle infinity values", () => {
      const condition: ConditionRef = {
        type: "gt",
        ref: { source: "infinityValue" },
        value: 1000000,
      };
      expect(evaluateCondition(condition, mockCtx, registry)).toBe(true);

      const condition2: ConditionRef = {
        type: "gt",
        ref: { source: "positiveNumber" },
        value: Number.NEGATIVE_INFINITY,
      };
      expect(evaluateCondition(condition2, mockCtx, registry)).toBe(true);
    });
  });

  describe("lt condition", () => {
    it("should return true when resolved value is less", () => {
      const conditions: ConditionRef[] = [
        { type: "lt", ref: { source: "positiveNumber" }, value: 43 },
        { type: "lt", ref: { source: "zeroNumber" }, value: 1 },
        { type: "lt", ref: { source: "negativeNumber" }, value: 0 },
        { type: "lt", ref: { source: "negativeNumber" }, value: -5 },
      ];

      for (const condition of conditions) {
        expect(evaluateCondition(condition, mockCtx, registry)).toBe(true);
      }
    });

    it("should return false when resolved value is greater or equal", () => {
      const conditions: ConditionRef[] = [
        { type: "lt", ref: { source: "positiveNumber" }, value: 42 }, // equal
        { type: "lt", ref: { source: "positiveNumber" }, value: 41 }, // greater
        { type: "lt", ref: { source: "zeroNumber" }, value: 0 }, // equal
        { type: "lt", ref: { source: "zeroNumber" }, value: -1 }, // greater
        { type: "lt", ref: { source: "negativeNumber" }, value: -10 }, // equal
        { type: "lt", ref: { source: "negativeNumber" }, value: -20 }, // greater
      ];

      for (const condition of conditions) {
        expect(evaluateCondition(condition, mockCtx, registry)).toBe(false);
      }
    });

    it("should return false for non-number values", () => {
      const conditions: ConditionRef[] = [
        { type: "lt", ref: { source: "nonEmptyString" }, value: 10 },
        { type: "lt", ref: { source: "truthyObject" }, value: 5 },
        { type: "lt", ref: { source: "nullValue" }, value: 0 },
        { type: "lt", ref: { source: "undefinedValue" }, value: 0 },
        { type: "lt", ref: { source: "nanValue" }, value: 0 },
        { type: "lt", ref: { source: "positiveNumber" }, value: "50" }, // string comparison value
      ];

      for (const condition of conditions) {
        expect(evaluateCondition(condition, mockCtx, registry)).toBe(false);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle registry resolution errors gracefully", () => {
      const errorRegistry = makeRegistry<typeof mockCtx, any>({
        errorSource: () => {
          throw new Error("Registry error");
        },
      });

      const condition: ConditionRef = {
        type: "exists",
        ref: { source: "errorSource" },
      };

      // Should not throw, should return false (exists check on undefined)
      const spy = vi.spyOn(console, "warn").mockReturnValue(undefined);
      expect(evaluateCondition(condition, mockCtx, errorRegistry)).toBe(false);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Unresolvable DataRef"));
      spy.mockRestore();
    });

    it("should handle circular object references in eq/neq", () => {
      const circularRegistry = makeRegistry<typeof mockCtx, any>({
        circular: () => {
          const obj: any = { name: "test" };
          obj.self = obj; // circular reference
          return obj;
        },
      });

      const condition: ConditionRef = {
        type: "eq",
        ref: { source: "circular" },
        value: { name: "test", self: {} },
      };

      // Should handle gracefully (fall back to === comparison)
      expect(evaluateCondition(condition, mockCtx, circularRegistry)).toBe(false);
    });

    it("should handle unknown condition types gracefully", () => {
      // TypeScript prevents this, but test runtime behavior
      const unknownCondition = {
        type: "unknown",
        ref: { source: "positiveNumber" },
      } as any;

      expect(evaluateCondition(unknownCondition, mockCtx, registry)).toBe(false);
    });
  });

  describe("integration tests", () => {
    it("should work with complex nested data", () => {
      const complexRegistry = makeRegistry<typeof mockCtx, any>({
        turnCount: (_ref, ctx) => ctx.turns.length,
        firstCharacterName: (_ref, ctx) => ctx.characters[0]?.name,
        hasStepInputs: (_ref, ctx) => Boolean(ctx.stepOutputs),
        stepPlan: (_ref, ctx) => (ctx as any).stepOutputs?.planner?.plan,
      });

      const conditions: { condition: ConditionRef; expected: boolean }[] = [
        {
          condition: { type: "exists", ref: { source: "turnCount" } },
          expected: true,
        },
        {
          condition: { type: "eq", ref: { source: "turnCount" }, value: 2 },
          expected: true,
        },
        {
          condition: { type: "gt", ref: { source: "turnCount" }, value: 1 },
          expected: true,
        },
        {
          condition: { type: "lt", ref: { source: "turnCount" }, value: 5 },
          expected: true,
        },
        {
          condition: {
            type: "eq",
            ref: { source: "firstCharacterName" },
            value: "Alice",
          },
          expected: true,
        },
        {
          condition: { type: "nonEmpty", ref: { source: "stepPlan" } },
          expected: true,
        },
        {
          condition: { type: "exists", ref: { source: "hasStepInputs" } },
          expected: true,
        },
      ];

      for (const { condition, expected } of conditions) {
        expect(evaluateCondition(condition, mockCtx, complexRegistry)).toBe(expected);
      }
    });
  });
});
