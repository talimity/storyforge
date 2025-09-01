import { makeRegistry } from "../../../source-registry.js";
import type { SourceRegistry } from "../../../types.js";

export type FakeTurnGenCtx = {
  turns: {
    turnNo: number;
    authorName: string;
    authorType: "character" | "narrator";
    content: string;
  }[];
  chapterSummaries: { chapterNo: number; summary: string }[];
  characters: { id: string; name: string; description: string }[];
  currentIntent: { description: string; constraint?: string };
  stepInputs: Record<string, unknown>;
  globals?: Record<string, unknown>;
};

export type FakeTurnGenSourceSpec = {
  turns: {
    args:
      | {
          order?: "asc" | "desc";
          limit?: number;
          start?: number;
          end?: number;
        }
      | undefined;
    out: {
      turnNo: number;
      authorName: string;
      authorType: "character" | "narrator";
      content: string;
    }[];
  };
  chapterSummaries: {
    args: { order?: "asc" | "desc"; limit?: number } | undefined;
    out: { chapterNo: number; summary: string }[];
  };
  characters: {
    args:
      | { order?: "asc" | "desc"; limit?: number; ids?: string[] }
      | undefined;
    out: { id: string; name: string; description: string }[];
  };
  stepOutput: { args: { key: string }; out: unknown };
  // Global value accessors
  globals: { args: undefined; out: Record<string, unknown> | undefined };
  worldName: { args: undefined; out: string | undefined };
  setting: { args: undefined; out: string | undefined };
  timeOfDay: { args: undefined; out: string | undefined };
  // Utility sources for testing conditions and examples
  intent: {
    args: undefined;
    out: { description: string; constraint?: string };
  };
  currentIntent: {
    args: undefined;
    out: { description: string; constraint?: string };
  };
  // Test data sources for edge cases
  emptyArray: { args: undefined; out: [] };
  emptyString: { args: undefined; out: "" };
  nullValue: { args: undefined; out: null };
  undefinedValue: { args: undefined; out: undefined };
};

/**
 * Spec-compliant registry for turn generation contexts that matches
 * the examples in the prompt template specification
 */
export function makeSpecTurnGenerationRegistry(): SourceRegistry<
  FakeTurnGenCtx,
  FakeTurnGenSourceSpec
> {
  return makeRegistry<FakeTurnGenCtx, FakeTurnGenSourceSpec>({
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
    worldName: (_ref, ctx) => String(ctx.globals?.worldName),
    setting: (_ref, ctx) => String(ctx.globals?.setting),
    timeOfDay: (_ref, ctx) => String(ctx.globals?.timeOfDay),

    // Test data sources for edge cases
    emptyArray: () => [],
    emptyString: () => "",
    nullValue: () => null,
    undefinedValue: () => undefined,
  });
}

type FakeOrderTestSourceSpec = {
  numbers: {
    args: { order?: "asc" | "desc"; limit?: number } | undefined;
    out: number[];
  };
  strings: {
    args: { order?: "asc" | "desc"; limit?: number } | undefined;
    out: string[];
  };
};

/**
 * Registry specifically for testing array ordering behaviors
 */
export function makeOrderTestRegistry(): SourceRegistry<
  unknown,
  FakeOrderTestSourceSpec
> {
  return makeRegistry<unknown, FakeOrderTestSourceSpec>({
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
