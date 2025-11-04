import { type TaskKind, taskKindSchema } from "@storyforge/gentasks";
import type {
  AttachmentLaneSpec,
  LayoutNode,
  MessageBlock,
  SlotFrameAnchor,
  SlotFrameNode,
  SlotSpec,
  UnboundTemplate,
} from "@storyforge/prompt-rendering";
import { assertNever, createId } from "@storyforge/utils";
import { z } from "zod";
import {
  createChapterSeparatorAttachmentDraftFromSpec,
  ensureChapterSeparatorAttachmentDraft,
} from "@/features/template-builder/services/attachments/chapters";
import {
  createLoreAttachmentDraftFromSpec,
  ensureLoreAttachmentDraft,
} from "@/features/template-builder/services/attachments/lore";
import { isValidRecipeId } from "@/features/template-builder/services/recipe-registry";
import type {
  AttachmentLaneDraft,
  LayoutNodeDraft,
  MessageBlockDraft,
  SlotDraft,
  SlotFrameNodeDraft,
  TemplateDraft,
} from "@/features/template-builder/types";

/**
 * Convert a PromptTemplate from the API into a TemplateDraft for editing
 */
export function templateToDraft(template: UnboundTemplate): TemplateDraft {
  const task = taskKindSchema.parse(template.task);
  return {
    id: template.id,
    name: template.name,
    task,
    description: template.description || "",
    layoutDraft: template.layout
      .map(convertLayoutNodeToDraft)
      .filter((node): node is LayoutNodeDraft => node !== null),
    slotsDraft: convertSlotsToDraft(template.slots),
    attachmentDrafts: convertAttachmentsToDraft(template.attachments, task),
  };
}

/**
 * Convert layout nodes from engine format to draft format
 */
function convertLayoutNodeToDraft(node: LayoutNode): LayoutNodeDraft | null {
  const id = createId();

  switch (node.kind) {
    case "message":
      return {
        id,
        kind: "message",
        role: node.role,
        name: node.name,
        ...(node.content && { content: node.content }),
        ...(node.from && { from: node.from }),
        ...(node.when?.length && { when: node.when.slice() }),
      };

    case "slot": {
      const header = node.header?.map(convertSlotFrameNodeToDraft);
      const footer = node.footer?.map(convertSlotFrameNodeToDraft);
      return {
        id,
        kind: "slot",
        name: node.name,
        ...(header && header.length > 0 && { header }),
        ...(footer && footer.length > 0 && { footer }),
        ...(node.omitIfEmpty !== undefined && {
          omitIfEmpty: node.omitIfEmpty,
        }),
      };
    }

    case "anchor":
      // Anchors are currently not editable in the layout builder; skip them when converting.
      return null;

    default: {
      assertNever(node);
    }
  }
}

function convertMessageBlockToDraft(block: MessageBlock): MessageBlockDraft {
  return {
    role: block.role,
    ...(block.content && { content: block.content }),
    ...(block.from && { from: block.from }),
    ...(block.when?.length && { when: block.when.slice() }),
  };
}

const isSlotFrameAnchor = (node: SlotFrameNode): node is SlotFrameAnchor =>
  "kind" in node && node.kind === "anchor";

function convertSlotFrameNodeToDraft(node: SlotFrameNode): SlotFrameNodeDraft {
  if (isSlotFrameAnchor(node)) {
    return {
      kind: "anchor",
      key: node.key,
      ...(node.when?.length ? { when: node.when.slice() } : {}),
    } satisfies SlotFrameNodeDraft;
  }

  return convertMessageBlockToDraft(node);
}

const recipeMetaSchema = z
  .object({
    recipe: z.object({ id: z.string(), params: z.record(z.string(), z.unknown()) }),
  })
  .loose();

/**
 * Convert content slots from saved format to draft format
 * Note: This is a best-effort conversion since we lose the original recipe information
 */
function convertSlotsToDraft(slots: Record<string, SlotSpec>): Record<string, SlotDraft> {
  const slotsDraft: Record<string, SlotDraft> = {};

  for (const [name, slot] of Object.entries(slots)) {
    const recipeMeta = recipeMetaSchema.safeParse(slot.meta);
    if (!recipeMeta.success || !isValidRecipeId(recipeMeta.data.recipe.id)) {
      console.log(`Slot ${name} has no valid recipe meta, converting to custom format`);
      slotsDraft[name] = {
        recipeId: "custom",
        params: {}, // Custom slots will need manual configuration
        customSpec: JSON.stringify(slot, null, 2),
        name,
        priority: slot.priority,
        budget: slot.budget?.maxTokens,
      };
    } else {
      console.log(
        `Converting slot ${name} with recipe ${recipeMeta.data.recipe.id} to draft format`
      );
      slotsDraft[name] = {
        recipeId: recipeMeta.data.recipe.id,
        params: recipeMeta.data.recipe.params,
        name,
        priority: slot.priority,
        budget: slot.budget?.maxTokens,
      };
    }
  }

  return slotsDraft;
}

function convertAttachmentsToDraft(
  attachments: readonly AttachmentLaneSpec[] | undefined,
  task: TaskKind
): Record<string, AttachmentLaneDraft> {
  const drafts: Record<string, AttachmentLaneDraft> = {};

  if (task === "turn_generation" || task === "chapter_summarization") {
    const chapterSpec = attachments?.find((lane) => lane.id === "chapter_separators");
    const chapterDraft = createChapterSeparatorAttachmentDraftFromSpec(chapterSpec);
    drafts[chapterDraft.laneId] = chapterDraft;
    console.log("Converted chapter separator attachment to draft:", chapterDraft, chapterSpec);
  }

  if (task === "turn_generation") {
    const loreSpec = attachments?.find((lane) => lane.id === "lore");
    const loreDraft = createLoreAttachmentDraftFromSpec(loreSpec);
    drafts[loreDraft.laneId] = loreDraft;
    console.log("Converted lore attachment to draft:", loreDraft, loreSpec);
  }

  return drafts;
}

/**
 * Create a new blank template draft
 */
export function createBlankTemplate(task: TaskKind): TemplateDraft {
  const defaultLoreDraft = ensureLoreAttachmentDraft();
  const defaultChapterDraft = ensureChapterSeparatorAttachmentDraft();

  const attachments: Record<string, AttachmentLaneDraft> = {};

  if (task === "turn_generation") {
    attachments[defaultLoreDraft.laneId] = defaultLoreDraft;
    attachments[defaultChapterDraft.laneId] = defaultChapterDraft;
  } else if (task === "chapter_summarization") {
    attachments[defaultChapterDraft.laneId] = defaultChapterDraft;
  }

  return {
    id: createId(),
    name: "",
    description: "",
    task,
    layoutDraft: [
      {
        id: createId(),
        kind: "message",
        role: "system",
        content: "You are a storyteller.",
      },
    ],
    slotsDraft: {},
    attachmentDrafts: attachments,
  };
}
