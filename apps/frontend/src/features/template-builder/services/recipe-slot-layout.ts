import { coerceRecipeParams } from "@/features/template-builder/services/param-coercion";
import type {
  AnyRecipe,
  MessageBlockDraft,
  SlotFrameAnchorDraft,
  SlotFrameNodeDraft,
  SlotLayoutDraft,
} from "@/features/template-builder/types";

const isAnchorFrame = (frame: SlotFrameNodeDraft): frame is SlotFrameAnchorDraft =>
  "kind" in frame && frame.kind === "anchor";

function cloneAnchor(frame: SlotFrameAnchorDraft): SlotFrameAnchorDraft {
  return {
    kind: "anchor",
    key: frame.key,
    ...(frame.when ? { when: [...frame.when] } : {}),
  } satisfies SlotFrameAnchorDraft;
}

function cloneMessage(frame: MessageBlockDraft): MessageBlockDraft {
  return {
    role: frame.role,
    ...(frame.content ? { content: frame.content } : {}),
    ...(frame.from ? { from: { ...frame.from } } : {}),
    ...(frame.when ? { when: [...frame.when] } : {}),
  } satisfies MessageBlockDraft;
}

function cloneSlotFrame(frame: SlotFrameNodeDraft): SlotFrameNodeDraft {
  return isAnchorFrame(frame) ? cloneAnchor(frame) : cloneMessage(frame);
}

function cloneSlotFrames(frames?: readonly SlotFrameNodeDraft[]): SlotFrameNodeDraft[] | undefined {
  if (!frames) return undefined;
  return frames.map(cloneSlotFrame);
}

function firstMessageNode(frames?: readonly SlotFrameNodeDraft[]): MessageBlockDraft | undefined {
  if (!frames) return undefined;
  return frames.find((frame): frame is MessageBlockDraft => !isAnchorFrame(frame));
}

type SyncMode = "overwrite" | "preserveMessages";
type MessagePlacement = "before" | "after";

function mergeFrames(
  recipeFrames: readonly SlotFrameNodeDraft[] | undefined,
  existingFrames: readonly SlotFrameNodeDraft[] | undefined,
  mode: SyncMode,
  placement: MessagePlacement
): SlotFrameNodeDraft[] | undefined {
  const preserveMessages = mode === "preserveMessages";
  const existingMessage = preserveMessages ? firstMessageNode(existingFrames) : undefined;
  const copiedMessage = existingMessage ? cloneMessage(existingMessage) : undefined;

  const recipeClone = cloneSlotFrames(recipeFrames) ?? [];

  if (recipeClone.length > 0) {
    const anchorKeys = new Set(recipeClone.filter(isAnchorFrame).map((frame) => frame.key));

    if (existingFrames) {
      for (const frame of existingFrames) {
        if (!isAnchorFrame(frame)) continue;
        if (anchorKeys.has(frame.key)) continue;
        recipeClone.push(cloneAnchor(frame));
        anchorKeys.add(frame.key);
      }
    }

    if (copiedMessage) {
      if (placement === "before") {
        recipeClone.unshift(copiedMessage);
      } else {
        recipeClone.push(copiedMessage);
      }
    }

    return recipeClone;
  }

  const anchorFallback: SlotFrameNodeDraft[] = [];

  if (existingFrames) {
    for (const frame of existingFrames) {
      if (isAnchorFrame(frame)) {
        anchorFallback.push(cloneAnchor(frame));
      }
    }
  }

  const result: SlotFrameNodeDraft[] = [];
  if (copiedMessage && placement === "before") {
    result.push(copiedMessage);
  }
  result.push(...anchorFallback);
  if (copiedMessage && placement === "after") {
    result.push(copiedMessage);
  }

  return result.length > 0 ? result : undefined;
}

export interface SyncSlotLayoutWithRecipeOptions {
  recipe: AnyRecipe | undefined;
  params: Record<string, unknown>;
  layoutDraft: SlotLayoutDraft;
  mode?: SyncMode;
}

export interface SyncSlotLayoutWithRecipeResult {
  coercedParams: Record<string, unknown>;
}

export function syncSlotLayoutWithRecipe({
  recipe,
  params,
  layoutDraft,
  mode = "overwrite",
}: SyncSlotLayoutWithRecipeOptions): SyncSlotLayoutWithRecipeResult | undefined {
  if (!recipe?.buildSlotLayout) {
    return undefined;
  }

  const coercedParams = coerceRecipeParams(recipe.parameters, params);
  const frames = recipe.buildSlotLayout(coercedParams);

  if (!frames) {
    return { coercedParams };
  }

  const header = mergeFrames(frames.header, layoutDraft.header, mode, "after");
  const footer = mergeFrames(frames.footer, layoutDraft.footer, mode, "before");

  layoutDraft.header = header;
  layoutDraft.footer = footer;

  if (typeof frames.omitIfEmpty === "boolean") {
    layoutDraft.omitIfEmpty = frames.omitIfEmpty;
  } else if (mode === "overwrite" && layoutDraft.omitIfEmpty === undefined) {
    layoutDraft.omitIfEmpty = true;
  }

  return { coercedParams };
}
