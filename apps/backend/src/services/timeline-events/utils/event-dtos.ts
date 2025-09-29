import type { TimelineEventDTO } from "@storyforge/gentasks";
import { type DerivedTimelineEvent, timelineEvents } from "@storyforge/timeline-events";

export function eventDTOsByTurn(
  events: DerivedTimelineEvent[]
): Record<string, TimelineEventDTO[]> {
  const grouped: Record<string, TimelineEventDTO[]> = {};
  for (const ev of events) {
    if (ev.turnId === null) {
      continue;
    }
    const spec = timelineEvents[ev.kind]; // union of all specs
    const dto: TimelineEventDTO = {
      id: ev.id,
      kind: ev.kind,
      orderKey: ev.orderKey,
      payloadVersion: ev.payloadVersion,
      payload: ev.payload,
      // biome-ignore lint/suspicious/noExplicitAny: types are not narrowed by ev.kind
      prompt: spec.toPrompt?.(ev as any, ev.state),
    };

    const bucket = (grouped[ev.turnId] ??= []);
    bucket.push(dto);
  }
  return grouped;
}
