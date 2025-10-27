import type { RenderOptions } from "@storyforge/prompt-rendering";
import type { TurnGenCtx } from "../tasks/turn-generation.js";
import { buildNarrativeLoreRenderOptions } from "./narrative.js";

export { TURN_GEN_REQUIRED_ANCHORS } from "./narrative.js";

export function buildTurnGenRenderOptions(ctx: TurnGenCtx): RenderOptions {
  const extraSegments = ctx.currentIntent?.prompt ? [ctx.currentIntent.prompt] : undefined;
  return buildNarrativeLoreRenderOptions({
    turns: ctx.turns,
    lorebooks: ctx.lorebooks,
    extraSegments,
  });
}
