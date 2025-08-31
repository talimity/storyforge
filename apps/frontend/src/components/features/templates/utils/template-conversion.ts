import { type TaskKind, taskKindSchema } from "@storyforge/gentasks";
import type {
  LayoutNode,
  MessageBlock,
  SlotSpec,
  UnboundTemplate,
} from "@storyforge/prompt-rendering";
import { nanoid } from "nanoid";
import { z } from "zod";
import { isValidRecipeId } from "@/components/features/templates/recipes/registry";
import type {
  LayoutNodeDraft,
  MessageBlockDraft,
  SlotDraft,
  TemplateDraft,
} from "@/components/features/templates/types";

/**
 * Convert a PromptTemplate from the API into a TemplateDraft for editing
 */
export function templateToDraft(template: UnboundTemplate): TemplateDraft {
  return {
    id: template.id,
    name: template.name,
    task: taskKindSchema.parse(template.task),
    description: template.description || "",
    layoutDraft: template.layout.map(convertLayoutNodeToDraft),
    slotsDraft: convertSlotsToDraft(template.slots),
  };
}

/**
 * Convert layout nodes from engine format to draft format
 */
function convertLayoutNodeToDraft(node: LayoutNode): LayoutNodeDraft {
  const id = nanoid(8); // Generate UI tracking ID

  switch (node.kind) {
    case "message":
      return {
        id,
        kind: "message",
        role: node.role,
        ...(node.content && { content: node.content }),
        ...(node.from && { from: node.from }),
        ...(node.prefix && { prefix: node.prefix }),
      };

    case "slot":
      return {
        id,
        kind: "slot",
        name: node.name,
        ...(node.header && {
          header: convertMessageBlocksToDraft(node.header),
        }),
        ...(node.footer && {
          footer: convertMessageBlocksToDraft(node.footer),
        }),
        ...(node.omitIfEmpty !== undefined && {
          omitIfEmpty: node.omitIfEmpty,
        }),
      };

    default: {
      const exhaustive: never = node;
      throw new Error(
        `Unknown layout node kind: ${JSON.stringify(exhaustive)}`
      );
    }
  }
}

/**
 * Convert message blocks from engine format to draft format
 */
function convertMessageBlocksToDraft(
  blocks: MessageBlock | MessageBlock[]
): MessageBlockDraft | MessageBlockDraft[] {
  if (Array.isArray(blocks)) {
    return blocks.map(convertMessageBlockToDraft);
  } else {
    return convertMessageBlockToDraft(blocks);
  }
}

function convertMessageBlockToDraft(block: MessageBlock): MessageBlockDraft {
  return {
    role: block.role,
    ...(block.content && { content: block.content }),
    ...(block.from && { from: block.from }),
    ...(block.prefix && { prefix: block.prefix }),
  };
}

const recipeMetaSchema = z
  .object({
    recipe: z.object({
      id: z.string(),
      params: z.record(z.string(), z.unknown()),
    }),
  })
  .loose();

/**
 * Convert slots from engine format to draft format
 * Note: This is a best-effort conversion since we lose the original recipe information
 */
function convertSlotsToDraft(
  slots: Record<string, SlotSpec>
): Record<string, SlotDraft> {
  const slotsDraft: Record<string, SlotDraft> = {};

  for (const [name, slot] of Object.entries(slots)) {
    const recipeMeta = recipeMetaSchema.safeParse(slot.meta);
    if (!recipeMeta.success || !isValidRecipeId(recipeMeta.data.recipe.id)) {
      console.log(
        `Slot ${name} has no valid recipe meta, converting to custom format`
      );
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

/**
 * Create a new blank template draft
 */
export function createBlankTemplate(task: TaskKind): TemplateDraft {
  return {
    id: nanoid(12),
    name: "",
    description: "",
    task,
    layoutDraft: [
      {
        id: nanoid(8),
        kind: "message",
        role: "system",
        content: "You are a storyteller.",
      },
    ],
    slotsDraft: {},
  };
}
