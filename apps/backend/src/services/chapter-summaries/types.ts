import type { ChapterSummary } from "@storyforge/db";
import type { ChapterSummRange, TurnCtxDTO } from "@storyforge/gentasks";

export type ChapterSpan = {
  closingEventId: string;
  closingTurnId: string;
  chapterNumber: number;
  title: string | null;
  openingEventId: string | null;
  rangeStartChapterNumber: number;
  rangeEndChapterNumber: number;
  turnIds: string[];
  turns: TurnCtxDTO[];
};

export type ChapterSummaryRecord = ChapterSummary & {
  title: string | null;
};

export type ChapterDescriptor = {
  eventId: string;
  turnId: string | null;
  chapterNumber: number;
  title: string | null;
  openingEventId: string | null;
  rangeStartChapterNumber: number;
  rangeEndChapterNumber: number;
};

export type ChapterSummaryStatusState = "missing" | "ready" | "stale" | "running" | "error";

export type ChapterSummaryStatus = {
  closingEventId: string;
  closingTurnId: string;
  chapterNumber: number;
  title: string | null;
  range: ChapterSummRange;
  state: ChapterSummaryStatusState;
  summaryId: string | null;
  updatedAt: Date | null;
  turnCount: number | null;
  workflowId: string | null;
  modelProfileId: string | null;
  runId: string | null;
  lastError: string | null;
  staleReasons?: string[];
};
