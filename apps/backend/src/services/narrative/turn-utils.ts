import type { TimelineEventContext, TurnContext } from "@storyforge/gentasks";

type TurnInput = Omit<TurnContext, "events" | "chapterNumber"> &
  Partial<Pick<TurnContext, "chapterNumber">>;

export function attachEventsToTurns(
  turns: readonly TurnInput[],
  eventsByTurn: Record<string, TimelineEventContext[]>
): TurnContext[] {
  const chapterNumbers = computeChapterNumbers(turns, eventsByTurn);
  return turns.map((turn) => ({
    ...turn,
    chapterNumber: chapterNumbers.get(turn.turnId) ?? turn.chapterNumber ?? 1,
    events: eventsByTurn[turn.turnId] ?? [],
  }));
}

function computeChapterNumbers(
  turns: readonly TurnInput[],
  eventsByTurn: Record<string, TimelineEventContext[]>
): Map<string, number> {
  const chapters = new Map<string, number>();
  let currentChapter = 1;

  for (const turn of turns) {
    const explicit = turn.chapterNumber;
    if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
      currentChapter = explicit;
    }

    chapters.set(turn.turnId, currentChapter);

    const events = eventsByTurn[turn.turnId] ?? [];
    let breakCount = 0;
    for (const event of events) {
      if (event.kind === "chapter_break") {
        breakCount += 1;
      }
    }

    if (breakCount > 0) {
      currentChapter += breakCount;
    }
  }

  return chapters;
}
