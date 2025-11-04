import { makeRegistry } from "@storyforge/prompt-rendering";
import { exactKeys } from "@storyforge/utils";
import {
  makeNarrativeSourceHandlers,
  NARRATIVE_SOURCE_NAMES,
  type NarrativeSources,
} from "../shared/source.js";
import type {
  ChapterSummarizationContext,
  ChapterSummarizationGlobals,
  RenderContextSummarizationTarget,
} from "./context.js";

export type ChapterSummarizationSources = NarrativeSources & {
  globals: { args: never; out: ChapterSummarizationGlobals };
  target: { args: never; out: RenderContextSummarizationTarget };
};

export const chapterSummarizationRegistry = makeRegistry<
  ChapterSummarizationContext,
  ChapterSummarizationSources
>({
  ...makeNarrativeSourceHandlers<ChapterSummarizationContext>(),
  globals: (_ref, ctx) => ctx.globals,
  target: (_ref, ctx) => ctx.target,
});

export const CHAPTER_SUMMARIZATION_SOURCE_NAMES = exactKeys<ChapterSummarizationSources>()(
  ...NARRATIVE_SOURCE_NAMES,
  "target",
  "globals"
);
