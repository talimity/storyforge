import type {
  LayoutNode,
  MessageBlock,
  PromptTemplate,
  SlotSpec,
} from "@storyforge/prompt-renderer";
import { nanoid } from "nanoid";
import type {
  LayoutNodeDraft,
  MessageBlockDraft,
  SlotDraft,
  TemplateDraft,
} from "../types";

/**
 * Convert a PromptTemplate from the API into a TemplateDraft for editing
 */
export function templateToDraft(template: PromptTemplate): TemplateDraft {
  return {
    id: template.id,
    name: template.name,
    task: template.task,
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

    case "separator":
      return {
        id,
        kind: "separator",
        ...(node.text && { text: node.text }),
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

/**
 * Convert slots from engine format to draft format
 * Note: This is a best-effort conversion since we lose the original recipe information
 */
function convertSlotsToDraft(
  slots: Record<string, SlotSpec>
): Record<string, SlotDraft> {
  const slotsDraft: Record<string, SlotDraft> = {};

  for (const [name, slot] of Object.entries(slots)) {
    // For imported templates, we'll treat all slots as custom since we can't
    // reliably determine which recipe they came from
    slotsDraft[name] = {
      recipeId: "custom",
      params: {}, // Custom slots will need manual configuration
      name,
      priority: slot.priority,
      budget: slot.budget?.maxTokens,
    };
  }

  return slotsDraft;
}

/**
 * Create a new blank template draft
 */
export function createBlankTemplate(
  task: import("@storyforge/prompt-renderer").TaskKind
): TemplateDraft {
  return {
    id: nanoid(12),
    name: "",
    task,
    layoutDraft: [
      {
        id: nanoid(8),
        kind: "message",
        role: "system",
        content: "You are a helpful assistant.",
      },
    ],
    slotsDraft: {},
  };
}

/**
 * Create a template draft from a starter recipe
 */
export function createFromStarter(
  task: import("@storyforge/prompt-renderer").TaskKind,
  starterName: string
): TemplateDraft {
  const base = createBlankTemplate(task);

  // Add common starter patterns based on task type
  if (task === "turn_generation") {
    return {
      ...base,
      name: starterName,
      layoutDraft: [
        {
          id: nanoid(8),
          kind: "message",
          role: "system",
          content:
            "You write vivid, engaging narrative prose for a tabletop RPG session.",
        },
        {
          id: nanoid(8),
          kind: "slot",
          name: "context",
          header: {
            role: "user",
            content: "Current scene context:",
          },
          omitIfEmpty: true,
        },
        {
          id: nanoid(8),
          kind: "message",
          role: "user",
          content:
            "Write the next turn in 200-350 words. Focus on advancing the story.",
        },
      ],
      slotsDraft: {
        context: {
          recipeId: "timeline_basic",
          params: {
            maxTurns: 6,
            order: "desc",
            budget: 800,
          },
          name: "context",
          priority: 0,
          budget: 800,
        },
      },
    };
  }

  return {
    ...base,
    name: starterName,
  };
}
