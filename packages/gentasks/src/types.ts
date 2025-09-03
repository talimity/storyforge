import type { z } from "zod";
import type { taskKindSchema } from "./schemas.js";
import type {
  ChapterSummCtx,
  ChapterSummSources,
} from "./tasks/chapter-summarization.js";
import type { TurnGenCtx, TurnGenSources } from "./tasks/turn-generation.js";
import type {
  WritingAssistantCtx,
  WritingAssistantSources,
} from "./tasks/writing-assistant.js";

export type TurnCtxDTO = {
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
  /** Map of other layers of the turn, keyed by layer name. */
  layers: Record<string, string>;
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
