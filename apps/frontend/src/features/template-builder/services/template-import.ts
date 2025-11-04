import type { UnboundTemplate } from "@storyforge/prompt-rendering";
import { createId } from "@storyforge/utils";
import { templateToDraft } from "@/features/template-builder/services/template-conversion";
import type { SlotDraft, SlotLayoutDraft } from "@/features/template-builder/types";

export interface SlotBlockDraft {
  slot: SlotDraft;
  layout: SlotLayoutDraft;
}

/**
 * Break a template down into individual slot blocks that can be imported into another draft.
 * Each block contains the slot configuration and the corresponding layout node metadata.
 */
export function extractSlotBlocks(template: UnboundTemplate): SlotBlockDraft[] {
  const draft = templateToDraft(template);
  const blocks: SlotBlockDraft[] = [];

  for (const node of draft.layoutDraft) {
    if (node.kind !== "slot") continue;

    const slot = draft.slotsDraft[node.name];
    if (!slot) continue;

    blocks.push({
      slot: cloneSlotDraft(slot),
      layout: cloneSlotLayoutDraft(node),
    });
  }

  return blocks;
}

export function cloneSlotBlockDraft(block: SlotBlockDraft): SlotBlockDraft {
  return {
    slot: cloneSlotDraft(block.slot),
    layout: cloneSlotLayoutDraft(block.layout),
  };
}

function cloneSlotDraft(slot: SlotDraft): SlotDraft {
  const copy: SlotDraft = {
    recipeId: slot.recipeId,
    name: slot.name,
    priority: slot.priority,
    params: structuredClone(slot.params),
  };

  if (typeof slot.budget === "number") {
    copy.budget = slot.budget;
  }

  if (slot.customSpec) {
    copy.customSpec = slot.customSpec;
  }

  return copy;
}

function cloneSlotLayoutDraft(layout: SlotLayoutDraft): SlotLayoutDraft {
  return {
    id: createId(),
    kind: "slot",
    name: layout.name,
    header: layout.header ? structuredClone(layout.header) : undefined,
    footer: layout.footer ? structuredClone(layout.footer) : undefined,
    omitIfEmpty: layout.omitIfEmpty,
  };
}
