import type { z } from "zod";
import type { taskKindSchema } from "./schemas.js";
import type { ChapterSummCtx, ChapterSummSources } from "./tasks/chapter-summarization.js";
import type { TurnGenCtx, TurnGenSources } from "./tasks/turn-generation.js";
import type { WritingAssistantCtx, WritingAssistantSources } from "./tasks/writing-assistant.js";

// TODO: this type is duplicated in several places due to circular dependencies,
//       should be refactored to a shared location.
type IntentKind = "manual_control" | "guided_control" | "narrative_constraint" | "continue_story";

export type TurnCtxDTO = {
  /** Internal ID of the turn. */
  turnId: string;
  /** The 1-based turn number. */
  turnNo: number;
  /**
   * The name of the character who authored this turn, or 'Narrator' if it's a
   * narrator turn.
   */
  authorName: string;
  /** The type of the author. */
  authorType: "character" | "narrator";
  /** The content of the 'presentation' layer of the turn. */
  content: string;
  intent?: {
    /** The intent kind. */
    kind: IntentKind;
    /** If the turn was created by an Intent which has guidance text, the text. */
    text?: string;
    /**
     * A preformatted prompt string that describes the intent and any of its
     * parameters. Prompt templates can also definte their own using the
     * `intentKind` and `intentText` fields, but this field is provided for
     * convenience and as a potential default case.
     */
    prompt: string;
  };
  /** Map of other layers of the turn, keyed by layer name. */
  layers: Record<string, string>;
  /** Timeline events associated with this turn, ordered chronologically. */
  events: TimelineEventDTO[];
};

export type TimelineEventDTO = {
  id: string;
  kind: string;
  orderKey: string;
  payloadVersion: number;
  payload: unknown;
  prompt?: string;
};

export type CharacterCtxDTO = {
  id: string;
  name: string;
  description: string;
};

export type TaskKind = z.infer<typeof taskKindSchema>;
export type TaskSourcesMap = {
  turn_generation: TurnGenSources;
  chapter_summarization: ChapterSummSources;
  writing_assistant: WritingAssistantSources;
};

export type TaskContextMap = {
  turn_generation: TurnGenCtx;
  chapter_summarization: ChapterSummCtx;
  writing_assistant: WritingAssistantCtx;
};
export type SourcesFor<K extends TaskKind> = TaskSourcesMap[K];
export type ContextFor<K extends TaskKind> = TaskContextMap[K];
