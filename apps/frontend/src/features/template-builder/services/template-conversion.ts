import { type TaskKind, taskKindSchema } from "@storyforge/gentasks";
import type {
  AttachmentLaneSpec,
  LayoutNode,
  MessageBlock,
  SlotSpec,
  UnboundTemplate,
} from "@storyforge/prompt-rendering";
import { assertNever, createId } from "@storyforge/utils";
import { z } from "zod";
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

    case "slot":
      return {
        id,
        kind: "slot",
        name: node.name,
        ...(node.header && {
          header: convertMessageBlockToDraft(
            Array.isArray(node.header) ? node.header[0] : node.header
          ),
        }),
        ...(node.footer && {
          footer: convertMessageBlockToDraft(
            Array.isArray(node.footer) ? node.footer[0] : node.footer
          ),
        }),
        ...(node.omitIfEmpty !== undefined && {
          omitIfEmpty: node.omitIfEmpty,
        }),
      };

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
  if (task !== "turn_generation") {
    return {};
  }

  const loreSpec = attachments?.find((lane) => lane.id === "lore");
  const loreDraft = createLoreAttachmentDraftFromSpec(loreSpec);
  console.log("Converted lore attachment to draft:", loreDraft, loreSpec);

  return {
    [loreDraft.laneId]: loreDraft,
  } satisfies Record<string, AttachmentLaneDraft>;
}

/**
 * Create a new blank template draft
 */
export function createBlankTemplate(task: TaskKind): TemplateDraft {
  const defaultLoreDraft = ensureLoreAttachmentDraft();

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
    attachmentDrafts:
      task === "turn_generation"
        ? {
            [defaultLoreDraft.laneId]: defaultLoreDraft,
          }
        : {},
  };
}
