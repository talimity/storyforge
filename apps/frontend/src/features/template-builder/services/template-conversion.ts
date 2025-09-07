import { type TaskKind, taskKindSchema } from "@storyforge/gentasks";
import type {
  LayoutNode,
  MessageBlock,
  SlotSpec,
  UnboundTemplate,
} from "@storyforge/prompt-rendering";
import { createId } from "@storyforge/utils";
import { z } from "zod";
import { isValidRecipeId } from "@/features/template-builder/services/recipe-registry";
import type {
  LayoutNodeDraft,
  MessageBlockDraft,
  SlotDraft,
  TemplateDraft,
} from "@/features/template-builder/types";

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
  const id = createId();

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

    default: {
      const exhaustive: never = node;
      throw new Error(`Unknown layout node kind: ${JSON.stringify(exhaustive)}`);
    }
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

/**
 * Create a new blank template draft
 */
export function createBlankTemplate(task: TaskKind): TemplateDraft {
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
  };
}
