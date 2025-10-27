import type { TimelineEventDTO, TurnCtxDTO } from "@storyforge/gentasks";

type TurnLike = Omit<TurnCtxDTO, "events"> | TurnCtxDTO;

export function attachEventsToTurns(
  turns: readonly TurnLike[],
  eventsByTurn: Record<string, TimelineEventDTO[]>
): TurnCtxDTO[] {
  return turns.map((turn) => ({
    ...turn,
    events: eventsByTurn[turn.turnId] ?? [],
  }));
}
