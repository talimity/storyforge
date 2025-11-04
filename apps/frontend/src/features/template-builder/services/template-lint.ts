import { LORE_ATTACHMENT_REQUIRED_ANCHORS, LORE_LANE_ID } from "@storyforge/gentasks";
import type {
  LayoutNode,
  PlanNode,
  PromptTemplate,
  UnboundTemplate,
} from "@storyforge/prompt-rendering";

export type TemplateLint = {
  level: "warning" | "error";
  code: string;
  message: string;
};

export function lintTemplate(template: UnboundTemplate | PromptTemplate<string>): TemplateLint[] {
  switch (template.task) {
    case "turn_generation":
      return lintTurnGenerationTemplate(template as PromptTemplate<"turn_generation">);
    default:
      return [];
  }
}

function lintTurnGenerationTemplate(template: PromptTemplate<"turn_generation">): TemplateLint[] {
  const anchors = collectAnchors(template);
  const warnings: TemplateLint[] = [];

  const loreLane = template.attachments?.find((lane) => lane.id === LORE_LANE_ID);
  if (!loreLane || loreLane.enabled === false) {
    warnings.push({
      level: "warning",
      code: "lore_lane_disabled",
      message:
        "Lore attachment lane is disabled or missing. Matched lore entries will not appear in prompts.",
    });
  }

  if (!anchors.has(LORE_ATTACHMENT_REQUIRED_ANCHORS.timeline.start)) {
    warnings.push({
      level: "warning",
      code: "missing_timeline_start_anchor",
      message: "Missing anchor 'timeline_start'. Timeline injections may not be placed correctly.",
    });
  }

  if (!anchors.has(LORE_ATTACHMENT_REQUIRED_ANCHORS.timeline.end)) {
    warnings.push({
      level: "warning",
      code: "missing_timeline_end_anchor",
      message:
        "Missing anchor 'timeline_end'. Timeline injections may not have a stable end marker.",
    });
  }

  const hasTurnAnchor = Array.from(anchors).some((key) => key.startsWith("turn_"));
  if (!hasTurnAnchor) {
    warnings.push({
      level: "warning",
      code: "missing_turn_anchors",
      message:
        "No per-turn anchors were found (expected keys like 'turn_{{item.turnNo}}'). Depth-based injections will be skipped.",
    });
  }

  if (!anchors.has(LORE_ATTACHMENT_REQUIRED_ANCHORS.characters.start)) {
    warnings.push({
      level: "warning",
      code: "missing_character_start_anchor",
      message:
        "Missing anchor 'character_definitions_start'. Lore and attachments cannot target the top of character definitions.",
    });
  }

  if (!anchors.has(LORE_ATTACHMENT_REQUIRED_ANCHORS.characters.end)) {
    warnings.push({
      level: "warning",
      code: "missing_character_end_anchor",
      message:
        "Missing anchor 'character_definitions_end'. Lore and attachments cannot target after character definitions.",
    });
  }

  return warnings;
}

function collectAnchors(template: PromptTemplate<string>): Set<string> {
  const anchors = new Set<string>();

  for (const node of template.layout ?? []) {
    collectAnchorsFromLayout(node, anchors);
  }

  for (const slot of Object.values(template.slots ?? {})) {
    collectAnchorsFromPlan(slot.plan ?? [], anchors);
  }

  return anchors;
}

function collectAnchorsFromLayout(node: LayoutNode, anchors: Set<string>): void {
  if (node.kind === "anchor") {
    anchors.add(node.key);
    return;
  }
  if (node.kind === "slot") {
    for (const frame of node.header ?? []) {
      if ("kind" in frame && frame.kind === "anchor") {
        anchors.add(frame.key);
      }
    }
    for (const frame of node.footer ?? []) {
      if ("kind" in frame && frame.kind === "anchor") {
        anchors.add(frame.key);
      }
    }
    return;
  }
}

function collectAnchorsFromPlan(nodes: readonly PlanNode[], anchors: Set<string>): void {
  for (const node of nodes) {
    switch (node.kind) {
      case "anchor":
        anchors.add(node.key);
        break;
      case "forEach":
        collectAnchorsFromPlan(node.map, anchors);
        break;
      case "if":
        collectAnchorsFromPlan(node.then, anchors);
        if (node.else) {
          collectAnchorsFromPlan(node.else, anchors);
        }
        break;
      case "message":
        break;
      default:
        break;
    }
  }
}
