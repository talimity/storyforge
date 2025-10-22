import type {
  ActivatedLoreEntry,
  ActivatedLoreIndex,
  LorebookAssignment,
  LorebookEntry,
} from "@storyforge/lorebooks";
import { scanLorebooks } from "@storyforge/lorebooks";
import type {
  AttachmentLaneSpec,
  InjectionRequest,
  InjectionTarget,
  RenderOptions,
} from "@storyforge/prompt-rendering";
import type { TurnGenCtx } from "../tasks/turn-generation.js";
import type { TurnCtxDTO } from "../types.js";

export const LORE_LANE_ID = "lore";

export const TURN_GEN_REQUIRED_ANCHORS = {
  timeline: {
    start: "timeline_start" as const,
    end: "timeline_end" as const,
  },
  characters: {
    start: "character_definitions_start" as const,
    end: "character_definitions_end" as const,
  },
};

/**
 * Default attachment lane definition used whenever a template does not supply
 * its own lore lane. Shared with the authoring UI so defaults remain
 * consistent.
 */
export function buildDefaultLoreLaneSpec(): AttachmentLaneSpec {
  return {
    id: LORE_LANE_ID,
    enabled: true,
    role: "system",
    template: "• {{payload.content}}",
    order: 50,
    // TODO: the template strings are illustrative; these are merely defaults for prompt templates which
    // have not set up their own attachment lanes, so they must be unopinionated.
    groups: [
      { id: "before_char", openTemplate: "## Setting Lore\n", closeTemplate: "\n" },
      { id: "after_char", openTemplate: "## Character Lore\n", closeTemplate: "\n" },
      // Apply this group rule to any injections targeting a specific turn.
      { match: "^turn_", openTemplate: "<relevant_lore>\n", closeTemplate: "</relevant_lore>\n" },
    ],
  };
}

type BuildOptions = {
  /** Optional override for the default lore attachment lane definition. */
  attachmentOverride?: Partial<AttachmentLaneSpec>;
};

/**
 * Build renderer runtime options (attachments + injections) for turn generation prompts.
 */
export function buildTurnGenRenderOptions(
  ctx: TurnGenCtx,
  options: BuildOptions = {}
): RenderOptions {
  const assignments = (ctx.lorebooks ?? []).filter((assignment) => assignment.enabled);
  const attachments = [createLoreLane(assignments, options.attachmentOverride)];
  const injections = assignments.length ? buildLoreInjections(ctx, assignments) : [];

  console.log("Built turn generation render options:", {
    attachments,
    injections,
  });

  return { attachments, injections };
}

function createLoreLane(
  assignments: readonly LorebookAssignment[],
  override?: Partial<AttachmentLaneSpec>
): AttachmentLaneSpec {
  const reserveTokens = assignments.reduce((total, assignment) => {
    const budget = assignment.data.token_budget ?? 0;
    return total + Math.max(budget, 0);
  }, 0);

  return {
    ...buildDefaultLoreLaneSpec(),
    reserveTokens: reserveTokens > 0 ? reserveTokens : undefined,
    ...override,
    id: LORE_LANE_ID,
  };
}

function buildLoreInjections(
  ctx: TurnGenCtx,
  assignments: readonly LorebookAssignment[]
): InjectionRequest[] {
  const turns = ctx.turns ?? [];
  const extraSegments = ctx.currentIntent?.prompt ? [ctx.currentIntent.prompt] : undefined;

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

function makeEntryKey(lorebookId: string, entryId: string | number): string {
  return `${lorebookId}::${String(entryId)}`;
}

function flattenActivatedEntries(index: ActivatedLoreIndex): ActivatedLoreEntry[] {
  return Object.values(index).flat();
}

function buildTargets(
  position: unknown,
  turns: readonly TurnCtxDTO[]
): { targets: InjectionTarget[]; groupId?: string } {
  if (position === "before_char") {
    return {
      groupId: "before_char",
      targets: [
        { kind: "at", key: TURN_GEN_REQUIRED_ANCHORS.characters.start },
        { kind: "boundary", position: "top", delta: 0 },
      ],
    };
  }

  if (position === "after_char") {
    return {
      groupId: "after_char",
      targets: [
        { kind: "at", key: TURN_GEN_REQUIRED_ANCHORS.characters.end },
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

/**
 * Given a numeric depth, returns injection targets for that depth within the
 * turn history. A fallback target for the timeline start/end boundary is always
 * included.
 */
function buildLoreDepthTargets(
  depth: number,
  turns: readonly TurnCtxDTO[]
): { targets: InjectionTarget[]; groupId?: string } {
  // No turns: target the timeline boundary directly.
  if (turns.length === 0) {
    return {
      groupId: "turn_0", // Ensures this receives formatting for turn-based lore.
      targets: [{ kind: "boundary", position: depth <= 0 ? "bottom" : "top", delta: 0 }],
    };
  }

  const index = resolveDepthIndex(depth, turns.length);
  const clampedIndex = Math.max(0, Math.min(index, turns.length - 1));
  const turn = turns[clampedIndex];
  const targets: InjectionTarget[] = [];
  let groupId: string | undefined;

  // Target the specific turn if possible.
  if (turn?.turnNo !== undefined) {
    targets.push({ kind: "at", key: `turn_${turn.turnNo}` });
    groupId = `turn_${turn.turnNo}`;
  } else {
    // Fallback: approximate via offset from timeline end.
    targets.push({ kind: "offset", key: TURN_GEN_REQUIRED_ANCHORS.timeline.start, delta: -1 });
  }

  // Always include a boundary fallback.
  targets.push({ kind: "boundary", position: depth <= 0 ? "bottom" : "top", delta: 0 });

  return { groupId, targets: dedupeTargets(targets) };
}

function resolveDepthIndex(depth: number, length: number): number {
  if (depth === 0) {
    return length - 1;
  }
  if (depth < 0) {
    return length - 1 + depth;
  }
  return depth;
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
