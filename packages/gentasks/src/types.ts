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

// DTOs for turn generation task
export type TurnCtxDTO = {
  turnNo: number;
  authorName: string;
  authorType: "character" | "narrator";
  content: string;
};
export type ChapterSummCtxDTO = {
  chapterNo: number;
  summary: string;
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
