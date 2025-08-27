import type { ChatCompletionMessageRole } from "@storyforge/prompt-renderer";
import {
  LuBot,
  LuLayers,
  LuMessageSquare,
  LuMinus,
  LuSettings,
  LuUser,
} from "react-icons/lu";
import type { LayoutNodeDraft, SlotDraft } from "../types";

/**
 * Get the color scheme for a layout node based on its type and role
 */
export function getNodeColor(node: LayoutNodeDraft): {
  borderColor: string;
  bgColor: string;
} {
  switch (node.kind) {
    case "message":
      switch (node.role) {
        case "system":
          return { borderColor: "neutral.600", bgColor: "neutral.50" };
        case "user":
          return { borderColor: "primary.600", bgColor: "primary.50" };
        case "assistant":
          return { borderColor: "secondary.600", bgColor: "secondary.50" };
        default:
          return { borderColor: "neutral.400", bgColor: "neutral.25" };
      }
    case "slot":
      return { borderColor: "accent.600", bgColor: "accent.50" };
    case "separator":
      return { borderColor: "neutral.400", bgColor: "neutral.25" };
    default:
      return { borderColor: "neutral.400", bgColor: "neutral.25" };
  }
}

/**
 * Get the appropriate icon for a layout node
 */
export function getNodeIcon(node: LayoutNodeDraft) {
  switch (node.kind) {
    case "message":
      switch (node.role) {
        case "system":
          return LuSettings;
        case "user":
          return LuUser;
        case "assistant":
          return LuBot;
        default:
          return LuMessageSquare;
      }
    case "slot":
      return LuLayers;
    case "separator":
      return LuMinus;
    default:
      return LuMessageSquare;
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
    case "separator":
      return `Separator${node.text ? `: ${node.text}` : ""}`;
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
      return "System";
    case "user":
      return "User";
    case "assistant":
      return "Assistant";
    default:
      return "Unknown";
  }
}

/**
 * Get color scheme for slot priority badges
 */
export function getPriorityColor(priority: number): string {
  if (priority === 0) return "red"; // Highest priority
  if (priority === 1) return "orange";
  if (priority === 2) return "yellow";
  if (priority <= 5) return "green";
  return "neutral"; // Low priority
}

/**
 * Generate a unique ID for new layout nodes
 */
export function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique name for new slots
 */
export function generateSlotName(
  existingSlots: Record<string, SlotDraft>,
  baseName: string = "slot"
): string {
  let counter = 1;
  let name = baseName;

  while (existingSlots[name]) {
    name = `${baseName}_${counter}`;
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
      return "You are a helpful assistant.";
    case "user":
      return "Enter your message here...";
    case "assistant":
      return "Assistant response...";
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
