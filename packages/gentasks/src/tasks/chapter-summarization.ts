import type {
  PromptTemplate,
  SourceHandlerMap,
  SourceRegistry,
} from "@storyforge/prompt-rendering";
import { makeRegistry } from "@storyforge/prompt-rendering";
import { exactKeys } from "@storyforge/utils";
import type { RuntimeSourceSpec, TurnCtxDTO } from "../types.js";
import {
  type ChapterSummaryCtxEntry,
  makeNarrativeSourceHandlers,
  type NarrativeContextBase,
  type NarrativeGlobalsBase,
  type NarrativeSourcesBase,
} from "./narrative-shared.js";

export type ChapterSummTarget = {
  closingEventId: string;
  closingTurnId: string;
  chapterNumber: number;
  turnIds: readonly string[];
  turnCount: number;
};

export type ChapterSummRange = {
  startChapterNumber: number;
  endChapterNumber: number;
};

export type ChapterSummGlobals = NarrativeGlobalsBase & {
  scenarioName?: string;
  range?: ChapterSummRange;
};

// Chapter summarization context
export type ChapterSummCtx = NarrativeContextBase & {
  globals: ChapterSummGlobals;
  target: ChapterSummTarget;
};

type SummaryArgs = { order?: "asc" | "desc"; limit?: number } | undefined;

const orderSummaries = (
  summaries: readonly ChapterSummaryCtxEntry[],
  args: SummaryArgs
): readonly ChapterSummaryCtxEntry[] => {
  const { order = "desc", limit } = args ?? {};
  const sorted = [...summaries].sort((a, b) =>
    order === "asc" ? a.chapterNumber - b.chapterNumber : b.chapterNumber - a.chapterNumber
  );
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
};

// Source specification for chapter summarization
export type ChapterSummSources = NarrativeSourcesBase & {
  chapterSummaries: {
    args: SummaryArgs;
    out: readonly ChapterSummaryCtxEntry[];
  };
  currentChapterTurns: { args: never; out: TurnCtxDTO[] };
  globals: { args: never; out: ChapterSummGlobals };
  target: { args: never; out: ChapterSummTarget };
};

// Convenience type aliases
export type ChapterSummTemplate = PromptTemplate<
  "chapter_summarization",
  ChapterSummSources & RuntimeSourceSpec
>;
export type ChapterSummRegistry = SourceRegistry<ChapterSummCtx, ChapterSummSources>;

const narrativeHandlers = makeNarrativeSourceHandlers<ChapterSummCtx>();

const makeChapterSummarizationRegistry = (
  handlers: SourceHandlerMap<ChapterSummCtx, ChapterSummSources>
) => makeRegistry<ChapterSummCtx, ChapterSummSources>(handlers);

export const chapterSummarizationRegistry = makeChapterSummarizationRegistry({
  ...narrativeHandlers,
  chapterSummaries: (ref, ctx) => orderSummaries(ctx.chapterSummaries ?? [], ref.args),
  currentChapterTurns: (_ref, ctx) => ctx.turns,
  globals: (_ref, ctx) => ctx.globals,
  target: (_ref, ctx) => ctx.target,
});

export const CHAPTER_SUMM_SOURCE_NAMES = exactKeys<ChapterSummSources>()(
  "turns",
  "characters",
  "chapterSummaries",
  "currentChapterTurns",
  "globals",
  "target"
);
