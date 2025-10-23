import { buildAttachmentRuntime, groupInjectionRequestsByLane } from "./attachments.js";
import { AuthoringValidationError, RenderError, TemplateStructureError } from "./errors.js";
import { runInjectionPass } from "./injection-pass.js";
import { assembleLayout, prepareLayout } from "./layout-assembler.js";
import { makeScopedRegistry } from "./scoped-registry.js";
import { executeSlots } from "./slot-executor.js";
import type {
  BudgetManager,
  ChatCompletionMessage,
  CompiledTemplate,
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
    const lanes = buildAttachmentRuntime(template.attachments, options?.attachmentDefaults);
    const filteredRequests = (options?.injections ?? []).filter((req) => lanes.has(req.lane));
    const requestsByLane = groupInjectionRequestsByLane(filteredRequests);

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
