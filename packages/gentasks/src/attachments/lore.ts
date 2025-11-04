import type {
  ActivatedLoreEntry,
  ActivatedLoreIndex,
  LorebookAssignment,
} from "@storyforge/lorebooks";
import { scanLorebooks } from "@storyforge/lorebooks";
import type {
  AttachmentLaneSpec,
  InjectionRequest,
  InjectionTarget,
  RenderOptions,
} from "@storyforge/prompt-rendering";
import type { TurnContext } from "../tasks/shared/dtos.js";

export const LORE_LANE_ID = "lore";
export const LORE_ATTACHMENT_REQUIRED_ANCHORS = {
  timeline: {
    start: "timeline_start",
    end: "timeline_end",
  },
  characters: {
    start: "character_definitions_start",
    end: "character_definitions_end",
  },
} as const;

export type LoreContext = {
  turns: readonly TurnContext[];
  lorebooks: readonly LorebookAssignment[];
  extraSegments?: readonly string[];
};

export function buildDefaultLoreLaneSpec(): AttachmentLaneSpec {
  return {
    id: LORE_LANE_ID,
    enabled: true,
    role: "system",
    template: "• {{payload.content}}\n",
    order: 50,
    groups: [
      { match: "^turn_", openTemplate: "<relevant_lore>\n", closeTemplate: "</relevant_lore>\n" },
      { id: "before_char", openTemplate: "## Setting Lore\n", closeTemplate: "\n" },
      { id: "after_char", openTemplate: "## Character Lore\n", closeTemplate: "\n" },
    ],
  };
}

export function buildLoreRenderOptions(ctx: LoreContext): RenderOptions {
  const assignments = (ctx.lorebooks ?? []).filter((assignment) => assignment.enabled);
  const attachmentDefaults = [createLoreLane(assignments)];
  const injections = assignments.length ? buildLoreInjections(ctx.turns, ctx, assignments) : [];
  return { attachmentDefaults, injections };
}

function createLoreLane(assignments: readonly LorebookAssignment[]): AttachmentLaneSpec {
  const reserveTokens = assignments.reduce((total, assignment) => {
    const budget = assignment.data.token_budget ?? 0;
    return total + Math.max(budget, 0);
  }, 0);

  const baseSpec = buildDefaultLoreLaneSpec();
  return {
    ...baseSpec,
    reserveTokens: reserveTokens > 0 ? reserveTokens : undefined,
    id: LORE_LANE_ID,
  };
}

function buildLoreInjections(
  turns: readonly TurnContext[],
  ctx: LoreContext,
  assignments: readonly LorebookAssignment[]
): InjectionRequest[] {
  const extraSegments = ctx.extraSegments?.length ? [...ctx.extraSegments] : undefined;

  const activation = scanLorebooks({
    turns,
    lorebooks: assignments,
    options: extraSegments ? { extraSegments } : undefined,
  });

  const lookup = buildEntryLookup(assignments);
  const entries = flattenActivatedEntries(activation);

  const requests: InjectionRequest[] = [];
  for (const entry of entries) {
    const key = makeEntryKey(entry.lorebookId, entry.entryId);
    const source = lookup.get(key);
    if (!source) continue;

    const rawPosition = entry.rawPosition ?? source.entry.position;
    const { targets, groupId } = buildTargets(rawPosition, turns);
    if (targets.length === 0) continue;

    requests.push({
      lane: LORE_LANE_ID,
      target: targets,
      payload: {
        content: entry.content,
        name: entry.name,
        comment: entry.comment,
        lorebookId: entry.lorebookId,
        entryId: entry.entryId,
      },
      priority: source.entry.priority ?? 0,
      groupId,
    });
  }

  return requests;
}

function buildEntryLookup(assignments: readonly LorebookAssignment[]) {
  const map = new Map<string, { assignment: LorebookAssignment; entry: LorebookEntry }>();
  for (const assignment of assignments) {
    for (const entry of assignment.data.entries) {
      const key = makeEntryKey(assignment.lorebookId, entry.id);
      map.set(key, { assignment, entry });
    }
  }
  return map;
}

type LorebookEntry = LorebookAssignment["data"]["entries"][number];

function makeEntryKey(lorebookId: string, entryId: string | number): string {
  return `${lorebookId}::${String(entryId)}`;
}

function flattenActivatedEntries(index: ActivatedLoreIndex): ActivatedLoreEntry[] {
  const records = index as Record<string | number, ActivatedLoreEntry[]>;
  return Object.values(records).flat();
}

function buildTargets(
  position: unknown,
  turns: readonly TurnContext[]
): { targets: InjectionTarget[]; groupId?: string } {
  if (position === "before_char") {
    return {
      groupId: "before_char",
      targets: [
        { kind: "at", key: LORE_ATTACHMENT_REQUIRED_ANCHORS.characters.start },
        { kind: "boundary", position: "top", delta: 0 },
      ],
    };
  }

  if (position === "after_char") {
    return {
      groupId: "after_char",
      targets: [
        { kind: "at", key: LORE_ATTACHMENT_REQUIRED_ANCHORS.characters.end },
        { kind: "boundary", position: "bottom", delta: 0 },
      ],
    };
  }

  if (typeof position === "string" && position.length > 0) {
    return { groupId: position, targets: [{ kind: "at", key: position }] };
  }

  if (typeof position === "number" && Number.isFinite(position)) {
    return buildLoreDepthTargets(position, turns);
  }

  return { targets: [] };
}

function buildLoreDepthTargets(
  depth: number,
  turns: readonly TurnContext[]
): { targets: InjectionTarget[]; groupId?: string } {
  if (turns.length === 0) {
    return {
      groupId: "turn_0",
      targets: [{ kind: "boundary", position: depth <= 0 ? "bottom" : "top", delta: 0 }],
    };
  }

  const index = resolveDepthIndex(depth, turns.length);
  const clampedIndex = Math.max(0, Math.min(index, turns.length - 1));
  const turn = turns[clampedIndex];
  const targets: InjectionTarget[] = [];
  let groupId: string | undefined;

  if (turn?.turnNo !== undefined) {
    targets.push({ kind: "at", key: `turn_${turn.turnNo}` });
    groupId = `turn_${turn.turnNo}`;
  } else {
    targets.push({
      kind: "offset",
      key: LORE_ATTACHMENT_REQUIRED_ANCHORS.timeline.start,
      delta: -1,
    });
  }

  targets.push({ kind: "boundary", position: depth <= 0 ? "bottom" : "top", delta: 0 });

  return { targets: dedupeTargets(targets), groupId };
}

function resolveDepthIndex(depth: number, length: number): number {
  const maxIndex = Math.max(length - 1, 0);
  if (!Number.isFinite(depth)) return maxIndex;
  if (depth === 0) return maxIndex;
  if (depth < 0) {
    return Math.max(0, maxIndex + Math.floor(depth));
  }
  return Math.min(Math.floor(depth), maxIndex);
}

function dedupeTargets(targets: InjectionTarget[]): InjectionTarget[] {
  const seen = new Set<string>();
  const result: InjectionTarget[] = [];
  for (const target of targets) {
    const key = JSON.stringify(target);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(target);
  }
  return result;
}
