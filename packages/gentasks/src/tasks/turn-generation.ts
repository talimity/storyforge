import type {
  PromptTemplate,
  SourceHandlerMap,
} from "@storyforge/prompt-rendering";
import { makeRegistry } from "@storyforge/prompt-rendering";
import { exactKeys } from "@storyforge/utils";
import type { ChapterSummCtxDTO, CharacterCtxDTO, TurnCtxDTO } from "../types";

type TurnGenGlobals = {
  stCurrentCharName: string; // SillyTavern macro {{char}}
  stPersonaName: string; // SillyTavern macro {{user}}
  scenarioDescription: string; // SillyTavern macro {{scenario}}
};

// Turn generation context
export type TurnGenCtx = {
  turns: TurnCtxDTO[];
  chapterSummaries: ChapterSummCtxDTO[];
  characters: CharacterCtxDTO[];
  currentIntent: { description: string; constraint?: string };
  stepInputs: Record<string, unknown>;
  globals: TurnGenGlobals;
};

// Source specification for turn generation
export type TurnGenSources = {
  turns: {
    args:
      | { order?: "asc" | "desc"; limit?: number; start?: number; end?: number }
      | undefined;
    out: TurnCtxDTO[];
  };
  chapterSummaries: {
    args: { order?: "asc" | "desc"; limit?: number } | undefined;
    out: ChapterSummCtxDTO[];
  };
  characters: {
    args:
      | { order?: "asc" | "desc"; limit?: number; ids?: string[] }
      | undefined;
    out: CharacterCtxDTO[];
  };
  currentIntent: {
    args: never;
    out: TurnGenCtx["currentIntent"];
  };
  stepOutput: { args: { key: string }; out: unknown };
  globals: { args: never; out: TurnGenGlobals };

  // SillyTavern-style global accessors to make imported characters and prompts
  // work without modification
  // https://docs.sillytavern.app/usage/core-concepts/macros/#general-macros
  // There are many more macros, including impure ones that return random values
  // or timestamps, but these are the most common ones.
  /**
   * Resolves to the character authoring the current turn, per SillyTavern
   * conventions.
   */
  char: { args: never; out: string };
  /**
   * Resolves to the players's persona name, per SillyTavern conventions. We
   * do not have personas but the user can designate a character in a scenario
   * as the {{user}} proxy.
   */
  user: { args: never; out: string };
  /**
   * Resolves to the scenario's description. In SillyTavern, this maps to the
   * Scenario field on a TavernCard, which we do not use.
   */
  scenario: { args: never; out: string | undefined };
};

const makeTurnGenRegistry = (
  handlers: SourceHandlerMap<TurnGenCtx, TurnGenSources>
) => makeRegistry<TurnGenCtx, TurnGenSources>(handlers);

export const turnGenRegistry = makeTurnGenRegistry({
  /**
   * Retrieve turns with optional ordering, slicing, and limiting.
   * - `order`: "asc" (oldest first) or "desc" (newest first). Default is "desc".
   * - `start` and `end`: Indices to slice the turns array. Supports negative indices.
   * - `limit`: Maximum number of turns to return after slicing and ordering.
   */
  turns: (ref, ctx) => {
    const { order = "desc", limit, start, end } = ref.args ?? {};
    let arr = ctx.turns;

    const norm = (i: number, len: number) => (i < 0 ? len + i : i);

    if (typeof start === "number" || typeof end === "number") {
      const s = norm(start ?? 0, arr.length);
      const e = norm(end ?? arr.length - 1, arr.length);
      arr = arr.slice(Math.max(0, s), Math.min(arr.length, e + 1));
    }

    if (order === "desc") arr = [...arr].reverse();
    return typeof limit === "number" ? arr.slice(0, limit) : arr;
  },
  chapterSummaries: (ref, ctx) => {
    const { order = "desc", limit } = ref.args ?? {};
    const arr =
      order === "desc"
        ? [...ctx.chapterSummaries].reverse()
        : ctx.chapterSummaries;
    return typeof limit === "number" ? arr.slice(0, limit) : arr;
  },
  characters: (ref, ctx) => {
    const { order = "asc", limit, ids } = ref.args ?? {};
    let arr = ctx.characters;
    if (ids?.length) {
      const set = new Set(ids);
      arr = arr.filter((c) => set.has(c.id));
    }
    if (order === "desc") arr = [...arr].reverse();
    return typeof limit === "number" ? arr.slice(0, limit) : arr;
  },
  currentIntent: (_ref, ctx) => ctx.currentIntent,
  stepOutput: (ref, ctx) => ctx.stepInputs[ref.args.key],
  globals: (_ref, ctx) => ctx.globals,
  char: (_ref, ctx) => ctx.globals.stCurrentCharName,
  user: (_ref, ctx) => ctx.globals.stPersonaName,
  scenario: (_ref, ctx) => stringOrUndefined(ctx.globals.scenarioDescription),
});

export const TURN_GEN_SOURCE_NAMES = exactKeys<TurnGenSources>()(
  "turns",
  "chapterSummaries",
  "characters",
  "currentIntent",
  "stepOutput",
  "globals",
  "char",
  "user",
  "scenario"
);

// Convenience type aliases
export type TurnGenTemplate = PromptTemplate<"turn_generation", TurnGenSources>;
export type TurnGenRegistry = typeof turnGenRegistry;

function stringOrUndefined(val: unknown): string | undefined {
  return typeof val === "string" ? val : undefined;
}
