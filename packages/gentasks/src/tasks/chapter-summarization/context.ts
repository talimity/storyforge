import type { NarrativeContext, NarrativeGlobals } from "../shared/context.js";

export type RenderContextSummarizationTarget = {
  closingEventId: string;
  closingTurnId: string;
  chapterNumber: number;
  turnIds: readonly string[];
  turnCount: number;
};

export type ChapterSummarizationGlobals = NarrativeGlobals & {
  scenarioName?: string;
  currentChapterNumber?: number;
};

export type ChapterSummarizationContext = NarrativeContext & {
  globals: ChapterSummarizationGlobals;
  target: RenderContextSummarizationTarget;
};
