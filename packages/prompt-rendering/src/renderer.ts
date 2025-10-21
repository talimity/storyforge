import { assertNever } from "@storyforge/utils";
import { AuthoringValidationError, RenderError, TemplateStructureError } from "./errors.js";
import { assembleLayout, prepareLayout } from "./layout-assembler.js";
import { compileLeaf } from "./leaf-compiler.js";
import { makeScopedRegistry } from "./scoped-registry.js";
import { executeSlots } from "./slot-executor.js";
import type {
  AttachmentLaneRuntime,
  AttachmentLaneSpec,
  BudgetManager,
  ChatCompletionMessage,
  CompiledAttachmentLaneSpec,
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

    let consumed = 0;

    // Process all requests for this lane within its budget context
    budget.withLane(lane.id, () => {
      // Each lane can have its own sub-budget constraints
      budget.withNodeBudget(lane.budget, () => {
        for (const request of sortedRequests) {
          const message = buildInjectionMessage(request, lane, ctx);
          if (!message) continue;

          const targetIndex = resolveInjectionIndex(request.target, anchorMap, messages.length);
          if (targetIndex === null) continue;

          const estimate = budget.estimateTokens(message.content);
          if (!budget.canFitTokenEstimate(message.content)) {
            continue;
          }

          budget.consume(message.content);
          consumed += estimate;
          messages.splice(targetIndex, 0, message);
          shiftAnchorMap(anchorMap, targetIndex); // Adjust anchors after insertion
        }
      });
    });

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
  ctx: Ctx
): ChatCompletionMessage | undefined {
  const templateFn = request.template ? compileLeaf(request.template) : lane.template;
  if (!templateFn) return undefined;
  const scope = { ctx, payload: { ...lane.payload, ...request.payload } };
  const content = templateFn(scope);
  if (!content) return undefined;
  return {
    role: request.role ?? lane.role ?? "system",
    content,
  };
}

// Combine compiled lane specs with runtime overrides to produce the final lane
// runtime map. We do this so we can add new lane definitions without all old
// templates needing to be re-authored to include them.
function buildLaneRuntime(
  compiled: readonly CompiledAttachmentLaneSpec[] | undefined,
  overrides: readonly AttachmentLaneSpec[] | undefined
): Map<string, AttachmentLaneRuntime> {
  const lanes = new Map<string, AttachmentLaneRuntime>();
  if (compiled) {
    for (const lane of compiled) {
      lanes.set(lane.id, { ...lane });
    }
  }
  if (overrides) {
    for (const lane of overrides) {
      lanes.set(lane.id, {
        id: lane.id,
        enabled: lane.enabled !== false,
        role: lane.role,
        template: lane.template ? compileLeaf(lane.template) : undefined,
        order: lane.order ?? 0,
        reserveTokens: lane.reserveTokens,
        budget: lane.budget,
        payload: lane.payload,
      });
    }
  }
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
