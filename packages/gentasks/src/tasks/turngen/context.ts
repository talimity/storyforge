import type { NarrativeContext, NarrativeGlobals } from "../shared/context.js";
import type { CharacterContext } from "../shared/dtos.js";

export type TurnGenGlobals = NarrativeGlobals & {
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
   * The 1-based chapter number of the most recent turn on the active timeline.
   */
  currentChapterNumber: number;
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
export type TurnGenContext = NarrativeContext & {
  /**
   * The intent input that triggered this turn generation, if any.
   */
  currentIntent?: { kind: string; prompt?: string; constraint?: string };
  /**
   * The turn number of the next turn (ie. the one that will be generated).
   */
  nextTurnNumber: number;
  /**
   * The character authoring the current turn.
   */
  actor: CharacterContext;
  /**
   * Extra global variables that can be accessed in prompts. Should always be
   * scalar values.
   */
  globals: TurnGenGlobals;
};
