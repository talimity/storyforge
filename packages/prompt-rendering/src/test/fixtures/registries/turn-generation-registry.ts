import { makeRegistry } from "@/source-registry";
import type { SourceRegistry } from "@/types";

/**
 * Spec-compliant registry for turn generation contexts that matches
 * the examples in the prompt template specification
 */
export function makeSpecTurnGenerationRegistry(): SourceRegistry<"turn_generation"> {
  return makeRegistry<"turn_generation">({
    // Core array sources with ordering and limiting
    turns: (ref, ctx) => {
      const args = ref.args as
        | { order?: "asc" | "desc"; limit?: number }
        | undefined;
      let result = [...ctx.turns];

      // Apply ordering (by turnNo)
      if (args?.order === "desc") {
        result.sort((a, b) => b.turnNo - a.turnNo);
      } else if (args?.order === "asc") {
        result.sort((a, b) => a.turnNo - b.turnNo);
      }

      // Apply limit
      if (args?.limit !== undefined) {
        result = result.slice(0, args.limit);
      }

      return result;
    },

    chapterSummaries: (ref, ctx) => {
      const args = ref.args as
        | { order?: "asc" | "desc"; limit?: number }
        | undefined;
      let result = [...ctx.chapterSummaries];

      // Apply ordering (by chapterNo)
      if (args?.order === "desc") {
        result.sort((a, b) => b.chapterNo - a.chapterNo);
      } else if (args?.order === "asc") {
        result.sort((a, b) => a.chapterNo - b.chapterNo);
      }

      // Apply limit
      if (args?.limit !== undefined) {
        result = result.slice(0, args.limit);
      }

      return result;
    },

    characters: (ref, ctx) => {
      const args = ref.args as
        | {
            ids?: string[];
            order?: "asc" | "desc";
            limit?: number;
          }
        | undefined;
      let result = [...ctx.characters];

      // Filter by IDs if provided
      if (args?.ids) {
        result = result.filter((char) => args.ids!.includes(char.id));
      }

      // Apply ordering (by name)
      if (args?.order === "desc") {
        result.sort((a, b) => b.name.localeCompare(a.name));
      } else if (args?.order === "asc") {
        result.sort((a, b) => a.name.localeCompare(b.name));
      }

      // Apply limit
      if (args?.limit !== undefined) {
        result = result.slice(0, args.limit);
      }

      return result;
    },

    // Simple value sources
    intent: (_ref, ctx) => ctx.currentIntent,

    // Step output resolver for chaining workflows
    stepOutput: (ref, ctx) => {
      const args = ref.args as { key: string };
      if (!ctx.stepInputs) return undefined;

      // Support nested keys like "planner.plan"
      const keys = args.key.split(".");
      let result: any = ctx.stepInputs;

      for (const key of keys) {
        if (result === null || result === undefined) return undefined;
        result = result[key];
      }

      return result;
    },

    // Utility sources for testing conditions and examples
    currentIntent: (_ref, ctx) => ctx.currentIntent,

    // Global value accessors
    globals: (_ref, ctx) => ctx.globals,
    worldName: (_ref, ctx) => ctx.globals?.worldName,
    setting: (_ref, ctx) => ctx.globals?.setting,
    timeOfDay: (_ref, ctx) => ctx.globals?.timeOfDay,

    // Test data sources for edge cases
    emptyArray: () => [],
    emptyString: () => "",
    nullValue: () => null,
    undefinedValue: () => undefined,
  });
}

/**
 * Registry specifically for testing array ordering behaviors
 */
export function makeOrderTestRegistry(): SourceRegistry<"turn_generation"> {
  return makeRegistry<"turn_generation">({
    // Test arrays for ordering validation
    numbers: (ref, _ctx) => {
      const args = ref.args as
        | { order?: "asc" | "desc"; limit?: number }
        | undefined;
      let result = [3, 1, 4, 1, 5, 9, 2, 6];

      if (args?.order === "desc") {
        result.sort((a, b) => b - a);
      } else if (args?.order === "asc") {
        result.sort((a, b) => a - b);
      }

      if (args?.limit !== undefined) {
        result = result.slice(0, args.limit);
      }

      return result;
    },

    strings: (ref, _ctx) => {
      const args = ref.args as
        | { order?: "asc" | "desc"; limit?: number }
        | undefined;
      let result = ["charlie", "alice", "bob", "david"];

      if (args?.order === "desc") {
        result.sort((a, b) => b.localeCompare(a));
      } else if (args?.order === "asc") {
        result.sort((a, b) => a.localeCompare(b));
      }

      if (args?.limit !== undefined) {
        result = result.slice(0, args.limit);
      }

      return result;
    },
  });
}
