import type { ChapterSummSources } from "./tasks/chapter-summarization";
import type { TurnGenSources } from "./tasks/turn-generation";
import type { WritingAssistantSources } from "./tasks/writing-assistant";

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

export type TaskSourcesMap = {
  turn_generation: TurnGenSources;
  chapter_summarization: ChapterSummSources;
  writing_assistant: WritingAssistantSources;
};
