import { describe, expect, it, vi } from "vitest";
import {
  exists,
  isArray,
  isNonEmpty,
  isNonEmptyArray,
  isString,
  isValidNumber,
  resolveAsArray,
  resolveAsNumber,
  resolveAsString,
  resolveDataRef,
} from "./data-ref-resolver.js";
import { makeRegistry } from "./source-registry.js";

describe("Type Guards", () => {
  describe("isArray", () => {
    it("should return true for arrays", () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray(["a", "b"])).toBe(true);
      expect(isArray([{ id: 1 }])).toBe(true);
    });

    it("should return false for non-arrays", () => {
      expect(isArray(null)).toBe(false);
      expect(isArray(undefined)).toBe(false);
      expect(isArray("string")).toBe(false);
      expect(isArray(123)).toBe(false);
      expect(isArray({})).toBe(false);
      expect(isArray(true)).toBe(false);
    });
  });

  describe("isNonEmptyArray", () => {
    it("should return true for non-empty arrays", () => {
      expect(isNonEmptyArray([1])).toBe(true);
      expect(isNonEmptyArray([1, 2, 3])).toBe(true);
      expect(isNonEmptyArray(["a"])).toBe(true);
    });

    it("should return false for empty arrays and non-arrays", () => {
      expect(isNonEmptyArray([])).toBe(false);
      expect(isNonEmptyArray(null)).toBe(false);
      expect(isNonEmptyArray(undefined)).toBe(false);
      expect(isNonEmptyArray("string")).toBe(false);
      expect(isNonEmptyArray(123)).toBe(false);
      expect(isNonEmptyArray({})).toBe(false);
    });
  });

  describe("isString", () => {
    it("should return true for strings", () => {
      expect(isString("")).toBe(true);
      expect(isString("hello")).toBe(true);
      expect(isString("123")).toBe(true);
    });

    it("should return false for non-strings", () => {
      expect(isString(123)).toBe(false);
      expect(isString(true)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString([])).toBe(false);
      expect(isString({})).toBe(false);
    });
  });

  describe("isValidNumber", () => {
    it("should return true for valid numbers (same as isNumber)", () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(123)).toBe(true);
      expect(isValidNumber(-456)).toBe(true);
      expect(isValidNumber(3.14)).toBe(true);
      expect(isValidNumber(Number.POSITIVE_INFINITY)).toBe(true);
      expect(isValidNumber(Number.NEGATIVE_INFINITY)).toBe(true);
    });

    it("should return false for NaN and non-numbers", () => {
      expect(isValidNumber(Number.NaN)).toBe(false);
      expect(isValidNumber("123")).toBe(false);
      expect(isValidNumber(null)).toBe(false);
      expect(isValidNumber(undefined)).toBe(false);
      expect(isValidNumber([])).toBe(false);
      expect(isValidNumber({})).toBe(false);
    });
  });

  describe("exists", () => {
    it("should return true for values that exist", () => {
      expect(exists(0)).toBe(true);
      expect(exists("")).toBe(true);
      expect(exists(false)).toBe(true);
      expect(exists([])).toBe(true);
      expect(exists({})).toBe(true);
      expect(exists("hello")).toBe(true);
      expect(exists(123)).toBe(true);
    });

    it("should return false for null and undefined", () => {
      expect(exists(null)).toBe(false);
      expect(exists(undefined)).toBe(false);
    });
  });

  describe("isNonEmpty", () => {
    it("should return true for non-empty arrays", () => {
      expect(isNonEmpty([1])).toBe(true);
      expect(isNonEmpty(["a", "b"])).toBe(true);
    });

    it("should return false for empty arrays", () => {
      expect(isNonEmpty([])).toBe(false);
    });

    it("should return true for non-empty strings", () => {
      expect(isNonEmpty("a")).toBe(true);
      expect(isNonEmpty("hello")).toBe(true);
    });

    it("should return false for empty strings", () => {
      expect(isNonEmpty("")).toBe(false);
    });

    it("should return falsy for other values", () => {
      expect(isNonEmpty(1)).toBe(false);
      expect(isNonEmpty(0)).toBe(false);
      expect(isNonEmpty(true)).toBe(false);
      expect(isNonEmpty(false)).toBe(false);
      expect(isNonEmpty({})).toBe(false);
      expect(isNonEmpty(null)).toBe(false);
      expect(isNonEmpty(undefined)).toBe(false);
    });
  });
});

describe("DataRef Resolution", () => {
  const mockCtx = {
    turns: [
      {
        turnNo: 1,
        authorName: "Alice",
        authorType: "character",
        content: "Hello",
      },
    ],
    chapterSummaries: [],
    chapters: [
      { chapterNumber: 1, title: "Chapter 1", breakEventId: "ev1", breakTurnId: "turn-1" },
    ],
    characters: [{ id: "alice", name: "Alice", description: "A warrior" }],
    currentIntent: { description: "Test intent" },
  };

  describe("resolveDataRef", () => {
    it("should resolve DataRefs through registry", () => {
      const registry = makeRegistry<typeof mockCtx, any>({
        turns: (_ref, ctx) => ctx.turns,
        characters: (_ref, ctx) => ctx.characters,
        intent: (_ref, ctx) => ctx.currentIntent,
      });

      const turnsRef = { args: undefined, source: "turns" };
      const charactersRef = { args: undefined, source: "characters" };
      const intentRef = { args: undefined, source: "intent" };

      expect(resolveDataRef(turnsRef, mockCtx, registry)).toBe(mockCtx.turns);
      expect(resolveDataRef(charactersRef, mockCtx, registry)).toBe(mockCtx.characters);
      expect(resolveDataRef(intentRef, mockCtx, registry)).toBe(mockCtx.currentIntent);
    });

    it("should return undefined for unknown sources", () => {
      const registry = makeRegistry<typeof mockCtx, any>({
        turns: (_ref, ctx) => ctx.turns,
      });

      const unknownRef = { args: undefined, source: "unknown" };
      expect(resolveDataRef(unknownRef, mockCtx, registry)).toBeUndefined();
    });

    it("should handle registry errors gracefully", () => {
      const registry = makeRegistry<typeof mockCtx, any>({
        errorSource: () => {
          throw new Error("Registry error");
        },
        goodSource: (_ref, ctx) => ctx.turns,
      });

      const errorRef = { args: undefined, source: "errorSource" };
      const goodRef = { args: undefined, source: "goodSource" };

      // Should return undefined for error case, not throw
      const spy = vi.spyOn(console, "warn").mockReturnValue(undefined);
      expect(resolveDataRef(errorRef, mockCtx, registry)).toBeUndefined();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Unresolvable DataRef"));
      spy.mockRestore();

      // Other sources should still work
      expect(resolveDataRef(goodRef, mockCtx, registry)).toBe(mockCtx.turns);
    });

    it("should handle null and undefined returns from registry", () => {
      const registry = makeRegistry<typeof mockCtx, any>({
        nullSource: () => null,
        undefinedSource: () => undefined,
      });

      const nullRef = { args: undefined, source: "nullSource" };
      const undefinedRef = { args: undefined, source: "undefinedSource" };

      expect(resolveDataRef(nullRef, mockCtx, registry)).toBeNull();
      expect(resolveDataRef(undefinedRef, mockCtx, registry)).toBeUndefined();
    });
  });

  describe("resolveAsArray", () => {
    it("should return arrays when resolution produces arrays", () => {
      const registry = makeRegistry<typeof mockCtx, any>({
        turns: (_ref, ctx) => ctx.turns,
        characters: (_ref, ctx) => ctx.characters,
        emptyArray: () => [],
      });

      const turnsRef = { args: undefined, source: "turns" };
      const charactersRef = { args: undefined, source: "characters" };
      const emptyRef = { args: undefined, source: "emptyArray" };

      expect(resolveAsArray(turnsRef, mockCtx, registry)).toBe(mockCtx.turns);
      expect(resolveAsArray(charactersRef, mockCtx, registry)).toBe(mockCtx.characters);
      expect(resolveAsArray(emptyRef, mockCtx, registry)).toEqual([]);
    });

    it("should return undefined for non-array results", () => {
      const registry = makeRegistry<typeof mockCtx, any>({
        string: () => "hello",
        number: () => 123,
        object: () => ({ id: 1 }),
        null: () => null,
        undefined: () => undefined,
      });

      expect(resolveAsArray({ source: "string" }, mockCtx, registry)).toBeUndefined();
      expect(resolveAsArray({ source: "number" }, mockCtx, registry)).toBeUndefined();
      expect(resolveAsArray({ source: "object" }, mockCtx, registry)).toBeUndefined();
      expect(resolveAsArray({ source: "null" }, mockCtx, registry)).toBeUndefined();
      expect(resolveAsArray({ source: "undefined" }, mockCtx, registry)).toBeUndefined();
    });
  });

  describe("resolveAsString", () => {
    it("should return strings when resolution produces strings", () => {
      const registry = makeRegistry<typeof mockCtx, any>({
        greeting: () => "hello",
        empty: () => "",
        description: (_ref, ctx) => ctx.currentIntent.description,
      });

      const greetingRef = { args: undefined, source: "greeting" };
      const emptyRef = { args: undefined, source: "empty" };
      const descRef = { args: undefined, source: "description" };

      expect(resolveAsString(greetingRef, mockCtx, registry)).toBe("hello");
      expect(resolveAsString(emptyRef, mockCtx, registry)).toBe("");
      expect(resolveAsString(descRef, mockCtx, registry)).toBe("Test intent");
    });

    it("should return undefined for non-string results", () => {
      const registry = makeRegistry<typeof mockCtx, any>({
        number: () => 123,
        array: () => ["hello"],
        object: () => ({ name: "hello" }),
        null: () => null,
        undefined: () => undefined,
      });

      expect(resolveAsString({ source: "number" }, mockCtx, registry)).toBeUndefined();
      expect(resolveAsString({ source: "array" }, mockCtx, registry)).toBeUndefined();
      expect(resolveAsString({ source: "object" }, mockCtx, registry)).toBeUndefined();
      expect(resolveAsString({ source: "null" }, mockCtx, registry)).toBeUndefined();
      expect(resolveAsString({ source: "undefined" }, mockCtx, registry)).toBeUndefined();
    });
  });

  describe("resolveAsNumber", () => {
    it("should return numbers when resolution produces valid numbers", () => {
      const registry = makeRegistry<typeof mockCtx, any>({
        zero: () => 0,
        positive: () => 123,
        negative: () => -45,
        decimal: () => 3.14,
        infinity: () => Number.POSITIVE_INFINITY,
      });

      expect(resolveAsNumber({ source: "zero" }, mockCtx, registry)).toBe(0);
      expect(resolveAsNumber({ source: "positive" }, mockCtx, registry)).toBe(123);
      expect(resolveAsNumber({ source: "negative" }, mockCtx, registry)).toBe(-45);
      expect(resolveAsNumber({ source: "decimal" }, mockCtx, registry)).toBe(3.14);
      expect(resolveAsNumber({ source: "infinity" }, mockCtx, registry)).toBe(
        Number.POSITIVE_INFINITY
      );
    });

    it("should return undefined for NaN and non-number results", () => {
      const registry = makeRegistry<typeof mockCtx, any>({
        nan: () => Number.NaN,
        string: () => "123",
        array: () => [123],
        object: () => ({ value: 123 }),
        null: () => null,
        undefined: () => undefined,
      });

      expect(resolveAsNumber({ source: "nan" }, mockCtx, registry)).toBeUndefined();
      expect(resolveAsNumber({ source: "string" }, mockCtx, registry)).toBeUndefined();
      expect(resolveAsNumber({ source: "array" }, mockCtx, registry)).toBeUndefined();
      expect(resolveAsNumber({ source: "object" }, mockCtx, registry)).toBeUndefined();
      expect(resolveAsNumber({ source: "null" }, mockCtx, registry)).toBeUndefined();
      expect(resolveAsNumber({ source: "undefined" }, mockCtx, registry)).toBeUndefined();
    });
  });

  describe("integration with args", () => {
    it("should work with DataRefs that have args", () => {
      const registry = makeRegistry<
        typeof mockCtx,
        {
          firstN: { args: { count: number }; out: typeof mockCtx.turns };
          repeat: { args: { text: string; times: number }; out: string };
        }
      >({
        firstN: (ref, ctx) => {
          const args = ref.args as { count: number };
          return ctx.turns.slice(0, args.count);
        },
        repeat: (ref, _ctx) => {
          const args = ref.args as { text: string; times: number };
          return args.text.repeat(args.times);
        },
      });

      const arrayRef = { source: "firstN" as const, args: { count: 1 } };
      const stringRef = {
        source: "repeat" as const,
        args: { text: "hi", times: 3 },
      };

      const arrayResult = resolveAsArray(arrayRef, mockCtx, registry);
      expect(arrayResult).toHaveLength(1);
      expect(arrayResult?.[0]).toBe(mockCtx.turns[0]);

      const stringResult = resolveAsString(stringRef, mockCtx, registry);
      expect(stringResult).toBe("hihihi");
    });
  });
});
