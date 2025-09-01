import type {
  PromptTemplate,
  SourceHandlerMap,
  SourceRegistry,
} from "@storyforge/prompt-rendering";
import { makeRegistry } from "@storyforge/prompt-rendering";
import { exactKeys } from "@storyforge/utils";
import type { ChapterSummCtxDTO, TurnCtxDTO } from "../types.js";

// Chapter summarization context
export type ChapterSummCtx = {
  turns: TurnCtxDTO[];
  chapterSummaries: ChapterSummCtxDTO[];
};

// Source specification for chapter summarization
export type ChapterSummSources = {
  previousSummaries: {
    args: { limit?: number } | undefined;
    out: ChapterSummCtxDTO[];
  };
  currentChapterTurns: { args: never; out: TurnCtxDTO[] };
};

// Convenience type aliases
export type ChapterSummTemplate = PromptTemplate<
  "chapter_summarization",
  ChapterSummSources
>;
export type ChapterSummRegistry = SourceRegistry<
  ChapterSummCtx,
  ChapterSummSources
>;

const makeChapterSummarizationRegistry = (
  handlers: SourceHandlerMap<ChapterSummCtx, ChapterSummSources>
) => makeRegistry<ChapterSummCtx, ChapterSummSources>(handlers);

export const chapterSummarizationRegistry = makeChapterSummarizationRegistry({
  previousSummaries: (ref, ctx) =>
    ctx.chapterSummaries.slice(ref.args?.limit ? -ref.args.limit : undefined),
  currentChapterTurns: (_ref, ctx) => ctx.turns,
});

export const CHAPTER_SUMM_SOURCE_NAMES = exactKeys<ChapterSummSources>()(
  "previousSummaries",
  "currentChapterTurns"
);
