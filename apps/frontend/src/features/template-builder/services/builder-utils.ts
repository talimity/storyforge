import type { ChatCompletionMessageRole } from "@storyforge/prompt-rendering";
import {
  LuBotMessageSquare,
  LuCog,
  LuLayers,
  LuMessageSquare,
  LuMessageSquareCode,
  LuMessageSquareMore,
} from "react-icons/lu";
import type {
  LayoutNodeDraft,
  SlotDraft,
} from "@/features/template-builder/types";

export const MESSAGE_ROLE_SELECT_OPTIONS = [
  { label: "System", value: "system" },
  { label: "User", value: "user" },
  { label: "Assistant", value: "assistant" },
] as const;

/**
 * Get the appropriate icon for a layout node
 */
export function getNodeIcon(node: { kind: string; role?: string }) {
  switch (node.kind) {
    case "message":
      switch (node.role) {
        case "system":
          return LuMessageSquareCode;
        case "user":
          return LuMessageSquareMore;
        case "assistant":
          return LuBotMessageSquare;
        default:
          return LuMessageSquare;
      }
    case "slot":
      return LuLayers;
    default:
      return LuCog;
  }
}

/**
 * Get a human-readable label for a layout node
 */
export function getNodeLabel(node: LayoutNodeDraft): string {
  switch (node.kind) {
    case "message": {
      const roleLabel = getRoleLabel(node.role);
      const content = node.content || node.from?.source || "Empty message";
      const truncated =
        content.length > 50 ? `${content.slice(0, 47)}...` : content;
      return `${roleLabel}: ${truncated}`;
    }
    case "slot":
      return `Slot: ${node.name}`;
    default:
      return "Unknown node";
  }
}

/**
 * Get a display label for message roles
 */
export function getRoleLabel(role: ChatCompletionMessageRole): string {
  switch (role) {
    case "system":
      return "System Message";
    case "user":
      return "User Message";
    case "assistant":
      return "Assistant Message";
    default:
      return "Unknown";
  }
}

/**
 * Generate a unique name for new slots
 */
export function generateSlotName(
  existingSlots: Record<string, SlotDraft>,
  baseName: string = "slot"
): string {
  // remove non-alphanumeric characters, remove leading underscores
  const safeName = baseName.replace(/[^a-zA-Z0-9_]/g, "").replace(/^_+/, "");
  let counter = 1;
  let name = safeName;

  while (existingSlots[name]) {
    name = `${safeName}_${counter}`;
    counter++;
  }

  return name;
}

/**
 * Check if a slot is referenced in the layout
 */
export function isSlotReferenced(
  slotName: string,
  layout: LayoutNodeDraft[]
): boolean {
  return layout.some((node) => node.kind === "slot" && node.name === slotName);
}

/**
 * Get the default content for a new message node
 */
export function getDefaultMessageContent(
  role: ChatCompletionMessageRole
): string {
  switch (role) {
    case "system":
      return "You are a storyteller.";
    case "user":
      return "Complete the following task...";
    case "assistant":
      return "Okay, I'll work on that.";
    default:
      return "";
  }
}

/**
 * Validate that all slot references in layout exist in slots
 */
export function validateSlotReferences(
  layout: LayoutNodeDraft[],
  slots: Record<string, SlotDraft>
): { valid: boolean; missingSlots: string[] } {
  const missingSlots: string[] = [];

  for (const node of layout) {
    if (node.kind === "slot" && !slots[node.name]) {
      missingSlots.push(node.name);
    }
  }

  return {
    valid: missingSlots.length === 0,
    missingSlots,
  };
}

/**
 * Format budget display for slots
 */
export function formatBudget(budget?: number): string {
  if (!budget) return "No limit";
  if (budget >= 1000) return `${(budget / 1000).toFixed(1)}k`;
  return budget.toString();
}

/**
 * Get status indicators for a slot
 */
export function getSlotStatus(
  slot: SlotDraft,
  layout: LayoutNodeDraft[]
): {
  isConfigured: boolean;
  isReferenced: boolean;
  hasWarnings: boolean;
  warnings: string[];
} {
  const isReferenced = isSlotReferenced(slot.name, layout);
  const warnings: string[] = [];

  // Check for common configuration issues
  if (!slot.budget || slot.budget === 0) {
    warnings.push("No budget limit set");
  }

  if (slot.recipeId === "custom" && !slot.params.plan) {
    warnings.push("Custom slot has no plan defined");
  }

  return {
    isConfigured: Object.keys(slot.params).length > 0,
    isReferenced,
    hasWarnings: warnings.length > 0,
    warnings,
  };
}

/**
 * Gets placeholder for message block identifier depending on its role
 */
export function getMessageBlockPlaceholder(
  role: ChatCompletionMessageRole
): string {
  switch (role) {
    case "system":
      return "e.g., System Prompt";
    case "user":
      return "e.g., Player Request";
    case "assistant":
      return "e.g., Prefill";
    default:
      return "Message content";
  }
}
