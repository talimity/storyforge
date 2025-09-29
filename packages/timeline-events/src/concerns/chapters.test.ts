import { describe, expect, it } from "vitest";
import type { TimelineEventEnvelopeOf } from "../types.js";
import { chapterBreakSpec, chaptersConcern } from "./chapters.js";

function makeChapterEvent(
  overrides: Partial<TimelineEventEnvelopeOf<"chapter_break">> & {
    payload?: { nextChapterTitle: string | null };
  }
): TimelineEventEnvelopeOf<"chapter_break"> {
  return {
    id: overrides.id ?? "event-1",
    turnId: overrides.turnId ?? null,
    orderKey: overrides.orderKey ?? "m",
    kind: "chapter_break",
    payloadVersion: overrides.payloadVersion ?? chapterBreakSpec.latest,
    payload: {
      nextChapterTitle: overrides.payload?.nextChapterTitle || null,
    },
  };
}

describe("chaptersConcern", () => {
  it("provides an empty initial state", () => {
    expect(chaptersConcern.initial()).toEqual({ chapters: [] });
  });

  it("adds chapters with sequential numbers regardless of turn id", () => {
    const initial = chaptersConcern.initial();

    const afterFirst = chaptersConcern.step(
      initial,
      makeChapterEvent({ id: "init", turnId: null, payload: { nextChapterTitle: "Prologue" } })
    );
    expect(afterFirst.chapters).toEqual([
      { number: 1, title: "Prologue", turnId: null, eventId: "init" },
    ]);

    const afterSecond = chaptersConcern.step(
      afterFirst,
      makeChapterEvent({ id: "ch2", turnId: "turn-1", payload: { nextChapterTitle: "Act 1" } })
    );
    expect(afterSecond.chapters).toEqual([
      { number: 1, title: "Prologue", turnId: null, eventId: "init" },
      { number: 2, title: "Act 1", turnId: "turn-1", eventId: "ch2" },
    ]);
  });

  it("formats prompts using the derived chapter number from state", () => {
    const initial = chaptersConcern.initial();
    const event = makeChapterEvent({ id: "ev", payload: { nextChapterTitle: "Prelude" } });
    const state = chaptersConcern.step(initial, event);

    const promptFirst = chapterBreakSpec.toPrompt?.(event, {
      chapters: state,
      presence: { participantPresence: {} },
    });
    expect(promptFirst).toBe("Chapter 1 begins: Prelude");

    const secondEvent = makeChapterEvent({ id: "ev2", payload: { nextChapterTitle: null } });
    const stateAfterSecond = chaptersConcern.step(state, secondEvent);
    const promptSecond = chapterBreakSpec.toPrompt?.(secondEvent, {
      chapters: stateAfterSecond,
      presence: { participantPresence: {} },
    });
    expect(promptSecond).toBe("Chapter 2 begins");
  });
});
