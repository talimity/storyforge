import type { RenderOptions } from "@storyforge/prompt-rendering";
import { buildLoreRenderOptions } from "../../attachments/lore.js";
import type { TurnGenContext } from "./context.js";

export function buildTurnGenRenderOptions(ctx: TurnGenContext): RenderOptions {
  const extraSegments = ctx.currentIntent?.prompt ? [ctx.currentIntent.prompt] : undefined;
  return buildLoreRenderOptions({
    turns: ctx.turns,
    lorebooks: ctx.lorebooks,
    extraSegments,
  });
}
