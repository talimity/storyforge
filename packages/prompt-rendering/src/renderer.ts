import { assertNever } from "@storyforge/utils";
import { AuthoringValidationError, RenderError, TemplateStructureError } from "./errors.js";
import { assembleLayout, prepareLayout } from "./layout-assembler.js";
import { compileLeaf } from "./leaf-compiler.js";
import { makeScopedRegistry } from "./scoped-registry.js";
import { executeSlots } from "./slot-executor.js";
import type {
  AttachmentLaneGroupRuntime,
  AttachmentLaneGroupSpec,
  AttachmentLaneRuntime,
  AttachmentLaneSpec,
  BudgetManager,
  ChatCompletionMessage,
  CompiledAttachmentLaneGroupSpec,
  CompiledAttachmentLaneSpec,
  CompiledLeafFunction,
  CompiledTemplate,
  GlobalAnchor,
  InjectionRequest,
  RenderOptions,
  SourceRegistry,
  SourceSpec,
} from "./types.js";

/**
 * Render a compiled template into an array of chat completion messages.
 *
 * This function performs the augmented rendering pipeline with layout floors,
 * logical lanes, and post-layout injections.
 */
export function render<K extends string, Ctx extends object, S extends SourceSpec>(
  template: CompiledTemplate<K, S>,
  ctx: Ctx,
  budget: BudgetManager,
  registry: SourceRegistry<Ctx, S>,
  options?: RenderOptions
): ChatCompletionMessage[] {
  try {
    const reg = makeScopedRegistry(registry, { frames: [] });

    // Phase 0: prepare the layout so we know how much budget to reserve for
    // static MessageNodes (which tend to be structural and important) before
    // we start distributing budget to dynamic slots and attachments.
    const preparedLayout = prepareLayout(template.layout, ctx, reg, budget);
    if (preparedLayout.floor > 0) {
      budget.reserveFloor("layout", preparedLayout.floor);
    }

    // Merge template attachments with runtime overrides so injections know
    // which lanes exist
    const lanes = buildLaneRuntime(template.attachments, options?.attachments);
    const filteredRequests = (options?.injections ?? []).filter((req) => lanes.has(req.lane));
    const requestsByLane = groupRequestsByLane(filteredRequests);

    // Reserve minimum tokens for each enabled lane that has injection requests.
    // We do this because injections depend on slot execution to position
    // injection anchors, but we don't want slot execution to consume all the
    // budget before injections get a chance to run.
    for (const [laneId, lane] of lanes) {
      if (!lane.enabled) continue;
      if (!requestsByLane.has(laneId)) continue;
      if (lane.reserveTokens) {
        budget.reserveFloor(laneId, lane.reserveTokens);
      }
    }

    // Phase A: Execute all slots to generate message buffers
    const slotBuffers = executeSlots(template.slots, ctx, budget, reg);

    // Phase B: Assemble the final message array using the layout
    const { messages: assembledMessages, anchors } = assembleLayout(
      preparedLayout,
      slotBuffers,
      budget
    );

    // Layout floor no longer needs to be protected after assembly, so give back
    // any unspent tokens.
    if (preparedLayout.floor > 0) {
      budget.releaseFloor("layout", preparedLayout.floor);
    }

    // Phase C: Run injection passes to insert attachment messages using the
    // available budget and the anchors collected during layout assembly.
    runInjectionPass({
      budget,
      lanes,
      requestsByLane,
      messages: assembledMessages,
      anchors,
      ctx,
    });

    // Post-process the message array to squash adjacent messages with the same role.
    // TODO: Allow templates to configure this or flag unsquashable messages.
    return squashMessages(assembledMessages);
  } catch (error) {
    if (
      error instanceof TemplateStructureError ||
      error instanceof AuthoringValidationError ||
      error instanceof RenderError
    ) {
      throw error;
    }

    const e = error instanceof Error ? error : new Error(String(error));
    throw new RenderError(`Unexpected error during template rendering: ${e.message}`, { cause: e });
  }
}

type InjectionContext<Ctx> = {
  budget: BudgetManager;
  lanes: Map<string, AttachmentLaneRuntime>;
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

function runInjectionPass<Ctx>({
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
  const templateFn = request.template ? compileLeaf(request.template) : lane.template;
  if (!templateFn) return undefined;
  const scope = { ctx, payload: { ...lane.payload, ...group?.payload, ...request.payload } };
  const content = templateFn(scope);
  if (!content) return undefined;
  return {
    role: request.role ?? lane.role ?? "system",
    content,
  };
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

function buildLaneRuntime(
  compiled: readonly CompiledAttachmentLaneSpec[] | undefined,
  overrides: readonly AttachmentLaneSpec[] | undefined
): Map<string, AttachmentLaneRuntime> {
  const lanes = new Map<string, AttachmentLaneRuntime>();

  if (compiled) {
    for (const lane of compiled) {
      lanes.set(lane.id, {
        id: lane.id,
        enabled: lane.enabled,
        role: lane.role,
        template: lane.template,
        order: lane.order,
        reserveTokens: lane.reserveTokens,
        budget: lane.budget,
        payload: lane.payload,
        groups: convertCompiledGroups(lane.id, lane.groups),
      });
    }
  }

  if (overrides) {
    for (const lane of overrides) {
      const existing = lanes.get(lane.id);
      const groups = lane.groups ? convertOverrideGroups(lane.id, lane.groups) : existing?.groups;

      lanes.set(lane.id, {
        id: lane.id,
        enabled: lane.enabled !== false,
        role: lane.role ?? existing?.role,
        template:
          lane.template === undefined
            ? existing?.template
            : lane.template
              ? compileLeaf(lane.template)
              : undefined,
        order: lane.order ?? existing?.order ?? 0,
        reserveTokens: lane.reserveTokens ?? existing?.reserveTokens,
        budget: lane.budget ?? existing?.budget,
        payload: lane.payload ?? existing?.payload,
        groups,
      });
    }
  }

  console.log("Built attachment lanes:", Array.from(lanes.values()));

  return lanes;
}

function groupRequestsByLane(
  requests: readonly InjectionRequest[]
): Map<string, readonly InjectionRequest[]> {
  const map = new Map<string, InjectionRequest[]>();
  for (const request of requests) {
    const existing = map.get(request.lane);
    if (existing) existing.push(request);
    else map.set(request.lane, [request]);
  }
  return map;
}

function convertCompiledGroups(
  laneId: string,
  groups: readonly CompiledAttachmentLaneGroupSpec[] | undefined
): readonly AttachmentLaneGroupRuntime[] | undefined {
  if (!groups || groups.length === 0) return undefined;
  const runtime = groups.map((group) => {
    let regex: RegExp | undefined;
    if (group.match) {
      try {
        regex = new RegExp(group.match);
      } catch {
        throw new TemplateStructureError(
          `Invalid group match regex '${group.match}' in attachment lane '${laneId}'.`
        );
      }
    }

    return Object.freeze({
      id: group.id,
      regex,
      openTemplate: group.openTemplate,
      closeTemplate: group.closeTemplate,
      role: group.role,
      order: group.order ?? 0,
      payload: group.payload,
    });
  });

  runtime.sort((a, b) => a.order - b.order);
  return Object.freeze(runtime);
}

function convertOverrideGroups(
  laneId: string,
  groups: readonly AttachmentLaneGroupSpec[] | undefined
): readonly AttachmentLaneGroupRuntime[] | undefined {
  if (!groups || groups.length === 0) return undefined;
  const runtime = groups.map((group) => {
    let regex: RegExp | undefined;
    if (group.match) {
      try {
        regex = new RegExp(group.match);
      } catch (error) {
        throw new RenderError(
          `Invalid group match regex '${group.match}' in attachment lane override '${laneId}'.`,
          { cause: error instanceof Error ? error : undefined }
        );
      }
    }

    return Object.freeze({
      id: group.id,
      regex,
      openTemplate: group.openTemplate ? compileLeaf(group.openTemplate) : undefined,
      closeTemplate: group.closeTemplate ? compileLeaf(group.closeTemplate) : undefined,
      role: group.role,
      order: group.order ?? 0,
      payload: group.payload,
    });
  });

  runtime.sort((a, b) => a.order - b.order);
  return Object.freeze(runtime);
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

      return target.after ? Math.min(baseIndex + 1, messageCount) : baseIndex;
    }
    case "offset": {
      const indices = anchorMap.get(target.key);
      if (!indices || indices.length === 0) {
        return null;
      }

      const base = indices[indices.length - 1];
      let index = base + target.delta;
      index = Math.max(0, Math.min(index, messageCount));

      return target.after ? Math.min(index + 1, messageCount) : index;
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

function squashMessages(messages: ChatCompletionMessage[]): ChatCompletionMessage[] {
  const result: ChatCompletionMessage[] = [];
  for (const msg of messages) {
    const last = result[result.length - 1];
    if (last && last.role === msg.role) {
      last.content += `\n${msg.content}`;
    } else {
      result.push({ ...msg });
    }
  }
  return result;
}
