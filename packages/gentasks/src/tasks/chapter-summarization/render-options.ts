import type { RenderOptions } from "@storyforge/prompt-rendering";
import { buildNarrativeRenderOptions } from "../shared/render-options.js";
import type { ChapterSummarizationContext } from "./context.js";

export function buildChapterSummarizationRenderOptions(
  ctx: ChapterSummarizationContext
): RenderOptions {
  return buildNarrativeRenderOptions(ctx);
}
