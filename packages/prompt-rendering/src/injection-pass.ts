import { assertNever } from "@storyforge/utils";
import type { AttachmentRuntimeMap } from "./attachments.js";
import { compileLeaf } from "./leaf-compiler.js";
import type {
  AttachmentLaneGroupRuntime,
  AttachmentLaneRuntime,
  BudgetManager,
  ChatCompletionMessage,
  CompiledLeafFunction,
  GlobalAnchor,
  InjectionRequest,
} from "./types.js";

type InjectionContext<Ctx> = {
  budget: BudgetManager;
  lanes: AttachmentRuntimeMap;
  requestsByLane: Map<string, readonly InjectionRequest[]>;
  messages: ChatCompletionMessage[];
  anchors: GlobalAnchor[];
  ctx: Ctx;
};

type LaneGroupState = {
  runtime: AttachmentLaneGroupRuntime;
  openInserted: boolean;
  lastIndex?: number;
};

export function runInjectionPass<Ctx>({
  budget,
  lanes,
  requestsByLane,
  messages,
  anchors,
  ctx,
}: InjectionContext<Ctx>): void {
  if (!requestsByLane.size) return;

  // Map anchor keys to message indices so we can resolve relative placements quickly.
  const anchorMap = buildAnchorMap(anchors);
  const laneList = [...lanes.values()].sort((a, b) => a.order - b.order);

  for (const lane of laneList) {
    if (!lane.enabled) continue;
    const laneRequests = requestsByLane.get(lane.id);
    if (!laneRequests || laneRequests.length === 0) {
      if (lane.reserveTokens) {
        // No requests to process, so release any reserved tokens.
        budget.releaseFloor(lane.id, lane.reserveTokens);
      }
      continue;
    }

    const sortedRequests = [...laneRequests]
      .map((req, index) => ({ req, index }))
      .sort((a, b) => {
        const pa = a.req.priority ?? 0;
        const pb = b.req.priority ?? 0;
        if (pa !== pb) return pa - pb;
        return a.index - b.index;
      })
      .map((entry) => entry.req);

    const groupStates = new Map<string, LaneGroupState>();
    let consumed = 0;

    // Process all requests for this lane within its budget context
    budget.withLane(lane.id, () => {
      // Each lane can have its own sub-budget constraints
      budget.withNodeBudget(lane.budget, () => {
        for (const request of sortedRequests) {
          const groupRuntime = resolveLaneGroup(lane.groups, request.groupId);

          let groupState: LaneGroupState | undefined;
          if (groupRuntime && request.groupId) {
            const existingState = groupStates.get(request.groupId);
            if (existingState) {
              existingState.runtime = groupRuntime;
              groupState = existingState;
            } else {
              groupState = { runtime: groupRuntime, openInserted: false };
              groupStates.set(request.groupId, groupState);
            }
          }

          const message = buildInjectionMessage(request, lane, groupRuntime, ctx);
          if (!message) continue;

          const targetIndex = resolveInjectionIndex(request.target, anchorMap, messages.length);
          if (targetIndex === null) continue;

          if (!budget.canFitTokenEstimate(message.content)) {
            continue;
          }

          // Insert main message first so we only add wrappers if content emitted.
          budget.consume(message.content);
          const messageIndex = targetIndex;
          consumed += budget.estimateTokens(message.content);
          messages.splice(messageIndex, 0, message);
          shiftAnchorMap(anchorMap, messageIndex);

          let finalIndex = messageIndex;

          if (groupState && !groupState.openInserted) {
            const openMessage = buildGroupWrapperMessage(
              groupState.runtime.openTemplate,
              lane,
              groupState.runtime,
              ctx
            );
            if (openMessage && budget.canFitTokenEstimate(openMessage.content)) {
              budget.consume(openMessage.content);
              consumed += budget.estimateTokens(openMessage.content);
              messages.splice(messageIndex, 0, openMessage);
              shiftAnchorMap(anchorMap, messageIndex);
              groupState.openInserted = true;
              finalIndex += 1; // message shifted by one
            }
          }

          if (groupState) {
            groupState.lastIndex = finalIndex;
          }
        }
      });
    });

    // Insert closing wrappers (processed in reverse order so indices remain valid)
    if (groupStates.size) {
      const closers = [...groupStates.values()]
        .filter(
          (state) =>
            state.openInserted && state.runtime.closeTemplate && state.lastIndex !== undefined
        )
        .sort((a, b) => (b.lastIndex ?? -1) - (a.lastIndex ?? -1));

      for (const state of closers) {
        const runtime = state.runtime;
        const closeMessage = buildGroupWrapperMessage(runtime.closeTemplate, lane, runtime, ctx);
        if (!closeMessage) continue;
        if (!budget.canFitTokenEstimate(closeMessage.content)) continue;
        const insertIndex = Math.min((state.lastIndex ?? 0) + 1, messages.length);
        budget.consume(closeMessage.content);
        consumed += budget.estimateTokens(closeMessage.content);
        messages.splice(insertIndex, 0, closeMessage);
        shiftAnchorMap(anchorMap, insertIndex);
      }
    }

    // Release any unspent reserved tokens for this lane
    if (lane.reserveTokens) {
      const remaining = Math.max(lane.reserveTokens - consumed, 0);
      budget.releaseFloor(lane.id, remaining);
    }
  }
}

function buildInjectionMessage<Ctx>(
  request: InjectionRequest,
  lane: AttachmentLaneRuntime,
  group: AttachmentLaneGroupRuntime | undefined,
  ctx: Ctx
): ChatCompletionMessage | undefined {
  // Resolve template string precedence: request > group > lane
  let templateFn: CompiledLeafFunction | undefined;
  if (request.template) {
    templateFn = compileLeaf(request.template);
  } else if (group?.template) {
    templateFn = group.template;
  } else {
    templateFn = lane.template;
  }
  if (!templateFn) return undefined;

  // Build scope with merged payloads: lane < group < request
  const scope = { ctx, payload: { ...lane.payload, ...group?.payload, ...request.payload } };
  const content = templateFn(scope);
  if (!content) return undefined;

  // Resolve role precedence: request > group > lane > default "system"
  const role = request.role ?? group?.role ?? lane.role ?? "system";
  return { role, content };
}

function buildGroupWrapperMessage<Ctx>(
  template: CompiledLeafFunction | undefined,
  lane: AttachmentLaneRuntime,
  group: AttachmentLaneGroupRuntime | undefined,
  ctx: Ctx
): ChatCompletionMessage | undefined {
  if (!template) return undefined;
  const scope = { ctx, payload: { ...lane.payload, ...group?.payload } };
  const content = template(scope);
  if (!content) return undefined;
  return {
    role: group?.role ?? lane.role ?? "system",
    content,
  };
}

function resolveLaneGroup(
  groups: readonly AttachmentLaneGroupRuntime[] | undefined,
  groupId: string | undefined
): AttachmentLaneGroupRuntime | undefined {
  if (!groups) return undefined;
  if (groupId) {
    const exact = groups.find((group) => group.id && group.id === groupId);
    if (exact) return exact;
    const regexMatch = groups.find((group) => group.regex?.test(groupId));
    if (regexMatch) return regexMatch;
  }
  return groups.find((group) => !group.id && !group.regex);
}

function buildAnchorMap(anchors: readonly GlobalAnchor[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const anchor of anchors) {
    if (!map.has(anchor.key)) {
      map.set(anchor.key, []);
    }
    map.get(anchor.key)?.push(anchor.index);
  }
  for (const indices of map.values()) {
    indices.sort((a, b) => a - b);
  }
  return map;
}

function resolveInjectionIndex(
  target: InjectionRequest["target"],
  anchorMap: Map<string, number[]>,
  messageCount: number
): number | null {
  // Support arrays of targets by resolving them in order and returning the first match.
  if (Array.isArray(target)) {
    for (const candidate of target) {
      const resolved = resolveInjectionIndex(candidate, anchorMap, messageCount);
      if (resolved !== null) {
        return resolved;
      }
    }
    return null;
  }

  switch (target.kind) {
    case "at": {
      const indices = anchorMap.get(target.key);
      if (!indices || indices.length === 0) {
        return null;
      }

      const occurrence = target.occurrence ?? "last";
      let baseIndex: number;
      if (occurrence === "first") {
        baseIndex = indices[0];
      } else if (occurrence === "last") {
        baseIndex = indices[indices.length - 1];
      } else {
        const idx = typeof occurrence === "number" ? occurrence : 0;
        baseIndex = indices[Math.min(Math.max(idx, 0), indices.length - 1)];
      }

      return baseIndex;
    }
    case "offset": {
      const indices = anchorMap.get(target.key);
      if (!indices || indices.length === 0) {
        return null;
      }

      const base = indices[indices.length - 1];
      let index = base + target.delta;
      index = Math.max(0, Math.min(index, messageCount));

      return index;
    }
    case "boundary": {
      const delta = target.delta ?? 0;
      if (target.position === "top") {
        return Math.max(0, Math.min(delta, messageCount));
      }
      if (target.position === "bottom") {
        return Math.max(0, Math.min(messageCount + delta, messageCount));
      }
      return null;
    }
    default:
      assertNever(target);
  }
}

// After inserting a message at insertIndex, adjust all anchor indices
// that come after it
function shiftAnchorMap(anchorMap: Map<string, number[]>, insertIndex: number): void {
  for (const indices of anchorMap.values()) {
    for (let i = 0; i < indices.length; i += 1) {
      if (indices[i] >= insertIndex) {
        indices[i] += 1;
      }
    }
  }
}
