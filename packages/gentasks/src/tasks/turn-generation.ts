import type {
  ActivatedLoreEntry,
  ActivatedLoreIndex,
  NormalizedLorebookPosition,
} from "@storyforge/lorebooks";
import type { PromptTemplate, SourceHandlerMap } from "@storyforge/prompt-rendering";
import { makeRegistry } from "@storyforge/prompt-rendering";
import { exactKeys } from "@storyforge/utils";
import type { CharacterCtxDTO, RuntimeSourceSpec, TurnCtxDTO } from "../types.js";

type TurnGenGlobals = {
  /** Whether the current turn is a narrator turn */
  isNarratorTurn: boolean;
  // SillyTavern-style global accessors to make imported characters and prompts
  // work without modification
  // https://docs.sillytavern.app/usage/core-concepts/macros/#general-macros
  // There are many more macros, including impure ones that return random values
  // or timestamps, but these are the most common ones.
  /**
   * Resolves to the character authoring the current turn, per SillyTavern
   * conventions
   */
  char: string;
  /**
   * Resolves to the players's persona name, per SillyTavern conventions. We
   * do not have personas but the user can designate a character in a scenario
   * as the {{user}} proxy.
   */
  user: string; // SillyTavern macro {{user}}
  /**
   * Resolves to the scenario's description. In SillyTavern, this maps to the
   * Scenario field on a TavernCard, which we do not use.
   */
  scenario?: string; // SillyTavern macro {{scenario}}
};

/**
 * The prompt rendering context for a single turn generation task. Provides
 * the backing data for the task's source handlers, as well as variables that
 * can be accessed directly via template strings.
 */
export type TurnGenCtx = {
  /**
   * All turns in the scenario, in chronological order. Should be accessed via
   * the `turns` source.
   */
  turns: TurnCtxDTO[];
  /**
   * All characters in the scenario. `character`-type characters are ordered
   * first, then `narrator`, then `persona`. Should be accessed via the
   * `characters` source.
   */
  characters: CharacterCtxDTO[];
  /**
   * The intent input that triggered this turn generation, if any.
   */
  currentIntent?: { kind: string; prompt?: string; constraint?: string };
  /**
   * The turn number of the next turn (ie. the one that will be generated).
   */
  nextTurnNumber: number;
  /**
   * Extra global variables that can be accessed in prompts. Should always be
   * scalar values.
   */
  globals: TurnGenGlobals;
  /** Activated lore entries organized by position. */
  loreEntriesByPosition: ActivatedLoreIndex;
};

/**
 * The source definitions for a turn generation task. Describes the data that
 * can be accessed in prompts via source handlers and the arguments that can be
 * passed to them.
 */
export type TurnGenSources = {
  turns: {
    args: { order?: "asc" | "desc"; limit?: number; start?: number; end?: number } | undefined;
    out: TurnCtxDTO[];
  };
  characters: {
    args: { order?: "asc" | "desc"; limit?: number; ids?: string[] } | undefined;
    out: CharacterCtxDTO[];
  };
  currentIntent: {
    args: never;
    out: TurnGenCtx["currentIntent"];
  };
  globals: { args: never; out: TurnGenGlobals };
  lore: {
    args: { position?: NormalizedLorebookPosition; limit?: number } | undefined;
    out: ActivatedLoreEntry[];
  };
};

const makeTurnGenRegistry = (handlers: SourceHandlerMap<TurnGenCtx, TurnGenSources>) =>
  makeRegistry<TurnGenCtx, TurnGenSources>(handlers);

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
  globals: (_ref, ctx) => ctx.globals,
  lore: (ref, ctx) => {
    const position: NormalizedLorebookPosition = ref.args?.position ?? "before_char";
    const entries = ctx.loreEntriesByPosition[position] ?? [];
    const limit = ref.args?.limit;
    if (typeof limit === "number") {
      if (limit <= 0) {
        return [];
      }
      return entries.slice(0, Math.floor(limit));
    }
    return entries;
  },
});

export const TURN_GEN_SOURCE_NAMES = exactKeys<TurnGenSources>()(
  "turns",
  "characters",
  "currentIntent",
  "globals",
  "lore"
);

export type TurnGenTemplate = PromptTemplate<"turn_generation", TurnGenSources & RuntimeSourceSpec>;
export type TurnGenRegistry = typeof turnGenRegistry;
