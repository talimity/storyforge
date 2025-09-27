import type { TimelineEventDTO } from "@storyforge/gentasks";
import {
  type RawTimelineEvent,
  type TimelineFinalState,
  timelineEventKindToConcern,
  timelineEvents,
} from "@storyforge/timeline-events";

export function eventDTOsByTurn(
  events: RawTimelineEvent[],
  hints: Map<string, Partial<Record<keyof TimelineFinalState, unknown>>>
): Record<string, { before: TimelineEventDTO[]; after: TimelineEventDTO[] }> {
  const grouped: Record<string, { before: TimelineEventDTO[]; after: TimelineEventDTO[] }> = {};
  for (const ev of events) {
    const spec = timelineEvents[ev.kind]; // union of all specs
    const bag = hints.get(ev.id) ?? {};
    const hint = bag[timelineEventKindToConcern[ev.kind] as keyof TimelineFinalState]; // unknown

    const dto: TimelineEventDTO = {
      id: ev.id,
      kind: ev.kind,
      orderKey: ev.orderKey,
      payloadVersion: ev.payloadVersion,
      payload: ev.payload,
      // biome-ignore lint/suspicious/noExplicitAny: types are not narrowed by ev.kind
      prompt: spec.toPrompt?.(ev as any, hint as any),
    };

    const slot = (grouped[ev.turnId] ??= { before: [], after: [] });
    (ev.position === "before" ? slot.before : slot.after).push(dto);
  }
  return grouped;
}
