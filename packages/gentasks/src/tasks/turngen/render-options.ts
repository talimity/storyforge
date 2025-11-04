import type { RenderOptions } from "@storyforge/prompt-rendering";
import { buildNarrativeRenderOptions } from "../shared/render-options.js";
import type { TurnGenContext } from "./context.js";

export function buildTurnGenRenderOptions(ctx: TurnGenContext): RenderOptions {
  const extraSegments = ctx.currentIntent?.prompt ? [ctx.currentIntent.prompt] : undefined;
  return buildNarrativeRenderOptions(ctx, { extraSegments });
}
