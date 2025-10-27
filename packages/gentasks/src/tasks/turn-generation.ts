import type { PromptTemplate, SourceHandlerMap } from "@storyforge/prompt-rendering";
import { makeRegistry } from "@storyforge/prompt-rendering";
import { exactKeys } from "@storyforge/utils";
import type { CharacterCtxDTO, RuntimeSourceSpec } from "../types.js";
import {
  type ChapterSummaryCtxEntry,
  makeNarrativeSourceHandlers,
  type NarrativeContextBase,
  type NarrativeGlobalsBase,
  type NarrativeSourcesBase,
} from "./narrative-shared.js";

type TurnGenGlobals = NarrativeGlobalsBase & {
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

type TurnGenContextBase = NarrativeContextBase & {
  /**
   * The character authoring the current turn.
   */
  actor: CharacterCtxDTO;
};

/**
 * The prompt rendering context for a single turn generation task. Provides
 * the backing data for the task's source handlers, as well as variables that
 * can be accessed directly via template strings.
 */
export type TurnGenCtx = TurnGenContextBase & {
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
};

/**
 * The source definitions for a turn generation task. Describes the data that
 * can be accessed in prompts via source handlers and the arguments that can be
 * passed to them.
 */
export type TurnGenSources = NarrativeSourcesBase & {
  chapterSummaries: {
    args: { order?: "asc" | "desc"; limit?: number } | undefined;
    out: readonly ChapterSummaryCtxEntry[];
  };
  currentIntent: {
    args: never;
    out: TurnGenCtx["currentIntent"];
  };
  globals: { args: never; out: TurnGenGlobals };
};

const narrativeHandlers = makeNarrativeSourceHandlers<TurnGenCtx>();

const makeTurnGenRegistry = (handlers: SourceHandlerMap<TurnGenCtx, TurnGenSources>) =>
  makeRegistry<TurnGenCtx, TurnGenSources>(handlers);

export const turnGenRegistry = makeTurnGenRegistry({
  ...narrativeHandlers,
  chapterSummaries: (ref, ctx) => {
    const summaries = ctx.chapterSummaries ?? [];
    const { order = "desc", limit } = ref.args ?? {};
    const sorted = [...summaries].sort((a, b) =>
      order === "asc" ? a.chapterNumber - b.chapterNumber : b.chapterNumber - a.chapterNumber
    );
    return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
  },
  currentIntent: (_ref, ctx) => ctx.currentIntent,
  globals: (_ref, ctx) => ctx.globals,
});

export const TURN_GEN_SOURCE_NAMES = exactKeys<TurnGenSources>()(
  "turns",
  "characters",
  "chapterSummaries",
  "currentIntent",
  "globals"
);

export type TurnGenTemplate = PromptTemplate<"turn_generation", TurnGenSources & RuntimeSourceSpec>;
export type TurnGenRegistry = typeof turnGenRegistry;
