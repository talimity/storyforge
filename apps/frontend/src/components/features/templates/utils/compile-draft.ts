import type {
  LayoutNode,
  MessageBlock,
  PlanNode,
  PromptTemplate,
  SlotSpec,
} from "@storyforge/prompt-renderer";
import { getRecipeById } from "../recipes/registry";
import type {
  LayoutNodeDraft,
  MessageBlockDraft,
  SlotDraft,
  TemplateDraft,
} from "../types";

/**
 * Compile a UI template draft into an engine-compatible PromptTemplate
 */
export function compileDraft(draft: TemplateDraft): PromptTemplate {
  return {
    id: draft.id,
    task: draft.task,
    name: draft.name,
    version: draft.version,
    layout: compileLayout(draft.layoutDraft),
    slots: compileSlots(draft.slotsDraft),
  };
}

/**
 * Convert layout draft nodes to engine layout nodes
 */
function compileLayout(layoutDraft: LayoutNodeDraft[]): LayoutNode[] {
  return layoutDraft.map(compileLayoutNode);
}

function compileLayoutNode(node: LayoutNodeDraft): LayoutNode {
  const nodeKind = node.kind;
  switch (nodeKind) {
    case "message":
      if (node.content && node.from) {
        throw new DraftCompilationError(
          "Layout message node cannot have both 'content' and 'from' properties - they are mutually exclusive",
          node
        );
      }

      return {
        kind: "message",
        ...(node.name && { name: node.name }),
        role: node.role,
        ...(node.content && { content: node.content }),
        ...(node.from && { from: node.from }),
        ...(node.prefix && { prefix: node.prefix }),
      };

    case "slot":
      return {
        kind: "slot",
        name: node.name,
        ...(node.header && { header: compileMessageBlocks(node.header) }),
        ...(node.footer && { footer: compileMessageBlocks(node.footer) }),
        ...(node.omitIfEmpty !== undefined && {
          omitIfEmpty: node.omitIfEmpty,
        }),
      };

    case "separator":
      return {
        kind: "separator",
        ...(node.text && { text: node.text }),
      };

    default: {
      const badNodeKind = nodeKind satisfies never;
      throw new Error(
        `Unknown layout node kind: ${JSON.stringify(badNodeKind)}`
      );
    }
  }
}

/**
 * Convert slots draft to engine slot specs
 */
function compileSlots(
  slotsDraft: Record<string, SlotDraft>
): Record<string, SlotSpec> {
  const slots: Record<string, SlotSpec> = {};

  for (const [name, slotDraft] of Object.entries(slotsDraft)) {
    slots[name] = compileSlot(slotDraft);
  }

  return slots;
}

/**
 * Walk through plan nodes and override all budget settings with the given maxTokens
 */
function overridePlanBudget(plan: PlanNode[], maxTokens: number): void {
  for (const node of plan) {
    if ("budget" in node && node.budget) {
      node.budget = { maxTokens };
    }
    if (node.kind === "forEach" && node.map) {
      // Child map can carry nested budgets too
      overridePlanBudget(node.map, maxTokens);
    } else if (node.kind === "if") {
      overridePlanBudget(node.then, maxTokens);
      if (node.else) {
        overridePlanBudget(node.else, maxTokens);
      }
    }
  }
}

function compileSlot(slotDraft: SlotDraft): SlotSpec {
  if (slotDraft.recipeId === "custom") {
    // For custom slots, we would need to parse the user's custom JSON
    // For now, return a minimal valid slot
    return {
      priority: slotDraft.priority,
      plan: [],
      ...(slotDraft.budget && { budget: { maxTokens: slotDraft.budget } }),
    };
  }

  // Recipe-backed slot: use the recipe to generate the slot spec
  const recipe = getRecipeById(slotDraft.recipeId);
  if (!recipe) {
    throw new Error(`Unknown recipe ID: ${slotDraft.recipeId}`);
  }

  // Start with the base slot spec from the recipe
  // Then override priority and budget if specified
  // Deep clone to avoid mutating the recipe's internal structures
  const baseSlotSpec = recipe.toSlotSpec(slotDraft.params);
  const slotSpec: SlotSpec = structuredClone({
    ...baseSlotSpec,
    priority: slotDraft.priority,
  });

  if (slotDraft.budget) {
    slotSpec.budget = { maxTokens: slotDraft.budget };
    overridePlanBudget(slotSpec.plan, slotDraft.budget);
  }

  return slotSpec;
}

/**
 * Normalize message blocks to arrays and compile them
 */
function compileMessageBlocks(
  blocks: MessageBlockDraft | MessageBlockDraft[]
): MessageBlock | MessageBlock[] {
  if (Array.isArray(blocks)) {
    return blocks.map(compileMessageBlock);
  } else {
    return compileMessageBlock(blocks);
  }
}

function compileMessageBlock(block: MessageBlockDraft): MessageBlock {
  if (block.content && block.from) {
    throw new DraftCompilationError(
      "Message block cannot have both 'content' and 'from' properties - they are mutually exclusive",
      block
    );
  }

  return {
    role: block.role,
    ...(block.content && { content: block.content }),
    ...(block.from && { from: block.from }),
    ...(block.prefix && { prefix: block.prefix }),
  };
}

/**
 * Error class for compilation issues
 */
export class DraftCompilationError extends Error {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "DraftCompilationError";
  }
}

/**
 * Validate that a draft can be compiled successfully
 */
export function validateDraft(draft: TemplateDraft): string[] {
  const errors: string[] = [];

  // Track which slots are referenced in the layout
  const referencedSlots = new Set<string>();

  // Check that slot references in layout exist
  for (const node of draft.layoutDraft) {
    if (node.kind === "slot") {
      referencedSlots.add(node.name);
      if (!(node.name in draft.slotsDraft)) {
        errors.push(`Layout references unknown slot: ${node.name}`);
      }
    }
  }

  // Check slots and detect unreachable ones
  for (const [slotName, slot] of Object.entries(draft.slotsDraft)) {
    // Check recipe validity
    if (slot.recipeId !== "custom") {
      const recipe = getRecipeById(slot.recipeId);
      if (!recipe) {
        errors.push(`Slot '${slotName}' uses unknown recipe: ${slot.recipeId}`);
      } else {
        // Ensure task compatibility
        if (recipe.task && recipe.task !== draft.task) {
          errors.push(
            `Slot '${slotName}' recipe '${slot.recipeId}' is not compatible with task '${draft.task}'`
          );
        }
      }
    }

    // Check for unreachable slots
    if (!referencedSlots.has(slotName)) {
      errors.push(
        `Slot '${slotName}' is defined but never referenced in layout`
      );
    }
  }

  return errors;
}
