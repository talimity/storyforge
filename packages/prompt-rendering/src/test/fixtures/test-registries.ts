import { makeRegistry } from "../../source-registry";
import type { SourceRegistry } from "../../types";

/**
 * Test registry for turn generation contexts with common data sources
 */
export function makeTurnGenTestRegistry(): SourceRegistry<"turn_generation"> {
  return makeRegistry<"turn_generation">({
    // Array sources
    turns: (_ref, ctx) => ctx.turns,
    recentTurns: (_ref, ctx) => ctx.turns, // Alias for turns for testing
    characters: (_ref, ctx) => ctx.characters,
    chapterSummaries: (_ref, ctx) => ctx.chapterSummaries,

    // Array sources with args
    firstNTurns: (ref, ctx) => {
      const args = ref.args as { count: number };
      return ctx.turns.slice(0, args.count);
    },
    lastNTurns: (ref, ctx) => {
      const args = ref.args as { count: number };
      return ctx.turns.slice(-args.count);
    },
    charactersByIds: (ref, ctx) => {
      const args = ref.args as { ids: string[] };
      return ctx.characters.filter((c) => args.ids.includes(c.id));
    },

    // Simple value sources
    turnCount: (_ref, ctx) => ctx.turns.length,
    characterCount: (_ref, ctx) => ctx.characters.length,
    worldName: (_ref, ctx) => ctx.globals?.worldName,
    currentIntent: (_ref, ctx) => ctx.currentIntent.description,
    intentConstraint: (_ref, ctx) => ctx.currentIntent.constraint,

    // Step inputs
    stepOutput: (ref, ctx) => {
      const args = ref.args as { key: string };
      return ctx.stepInputs?.[args.key];
    },
    plannerPlan: (_ref, ctx) => (ctx.stepInputs?.planner as any)?.plan,

    // Test values for different data types
    emptyArray: () => [],
    emptyString: () => "",
    nullValue: () => null,
    undefinedValue: () => undefined,
    zeroNumber: () => 0,
    positiveNumber: () => 42,
    negativeNumber: () => -10,
    booleanTrue: () => true,
    booleanFalse: () => false,
    simpleObject: () => ({ name: "test", value: 123 }),

    // Dynamic content generators
    greeting: (ref, _ctx) => {
      const args = ref.args as { name?: string } | undefined;
      return args?.name ? `Hello, ${args.name}!` : "Hello!";
    },
    repeat: (ref, _ctx) => {
      const args = ref.args as { text: string; times: number };
      return args.text.repeat(args.times);
    },

    // Error cases for testing
    errorThrowingSource: () => {
      throw new Error("Test error from registry");
    },
  });
}

/**
 * Registry that provides various array ordering test data
 */
export function makeOrderingTestRegistry(): SourceRegistry<"turn_generation"> {
  return makeRegistry<"turn_generation">({
    numbers: () => [3, 1, 4, 1, 5, 9, 2, 6],
    strings: () => ["charlie", "alice", "bob", "david"],
    objects: () => [
      { name: "Charlie", age: 30 },
      { name: "Alice", age: 25 },
      { name: "Bob", age: 35 },
    ],
    characters: (_ref, ctx) => ctx.characters,
    turns: (_ref, ctx) => ctx.turns,
    emptyArray: () => [],
    singleItem: () => ["only"],
    limitedNumbers: (ref, _ctx) => {
      const args = ref.args as { limit?: number } | undefined;
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      return args?.limit ? nums.slice(0, args.limit) : nums;
    },
  });
}

/**
 * Registry for testing conditional execution
 */
export function makeConditionTestRegistry(): SourceRegistry<"turn_generation"> {
  return makeRegistry<"turn_generation">({
    // Existence tests
    existsValue: () => "I exist",
    nullValue: () => null,
    undefinedValue: () => undefined,

    // Non-empty tests
    nonEmptyArray: () => [1, 2, 3],
    emptyArray: () => [],
    nonEmptyString: () => "content",
    emptyString: () => "",

    // Comparison tests
    number42: () => 42,
    numberZero: () => 0,
    stringHello: () => "hello",
    stringEmpty: () => "",
    objectA: () => ({ id: 1, name: "Alice" }),
    objectB: () => ({ id: 2, name: "Bob" }),
    arrayABC: () => ["a", "b", "c"],
    arrayXYZ: () => ["x", "y", "z"],

    // Dynamic values for testing
    contextTurnCount: (_ref, ctx) => ctx.turns.length,
    contextCharacterCount: (_ref, ctx) => ctx.characters.length,
    contextHasIntent: (_ref, ctx) => Boolean(ctx.currentIntent?.description),
  });
}
