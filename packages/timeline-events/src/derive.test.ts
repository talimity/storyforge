import { describe, expect, it, vi } from "vitest";
import { type TimelineEventDataLoader, TimelineStateDeriver } from "./derive.js";
import type { RawTimelineEvent } from "./types.js";

class StubLoader implements TimelineEventDataLoader {
  constructor(private readonly rows: RawTimelineEvent[]) {}

  async loadOrderedEventsAlongPath(): Promise<RawTimelineEvent[]> {
    return this.rows;
  }
}

describe("TimelineStateDeriver", () => {
  it("reduces events into final state and captures per-event states", async () => {
    const events: RawTimelineEvent[] = [
      {
        id: "init-chapter",
        turnId: null,
        orderKey: "a",
        kind: "chapter_break",
        payloadVersion: 1,
        payload: { nextChapterTitle: "Prologue" },
      },
      {
        id: "chapter-2",
        turnId: "turn-1",
        orderKey: "m",
        kind: "chapter_break",
        payloadVersion: 1,
        payload: { nextChapterTitle: "Act I" },
      },
      {
        id: "presence-1",
        turnId: "turn-1",
        orderKey: "n",
        kind: "presence_change",
        payloadVersion: 1,
        payload: { participantId: "char-A", active: false, status: null },
      },
    ];

    const loader = new StubLoader(events);
    const deriver = new TimelineStateDeriver(loader);

    const result = await deriver.run({ scenarioId: "scenario-1", leafTurnId: "turn-1" });

    expect(result.final.chapters.chapters).toEqual([
      { number: 1, title: "Prologue", turnId: null },
      { number: 2, title: "Act I", turnId: "turn-1" },
    ]);
    expect(result.final.presence.participantPresence).toEqual({
      "char-A": { active: false, status: null },
    });

    expect(result.events.map((ev) => ev.id)).toEqual(["init-chapter", "chapter-2", "presence-1"]);
    expect(result.events[0].state.chapters.chapters).toEqual([
      { number: 1, title: "Prologue", turnId: null },
    ]);
    expect(result.events[1].state.chapters.chapters).toEqual([
      { number: 1, title: "Prologue", turnId: null },
      { number: 2, title: "Act I", turnId: "turn-1" },
    ]);
    expect(result.events[2].state.presence.participantPresence).toEqual({
      "char-A": { active: false, status: null },
    });
  });

  it("passes scenario and leaf IDs to the loader", async () => {
    const loader: TimelineEventDataLoader = {
      loadOrderedEventsAlongPath: vi.fn().mockResolvedValue([]),
    };
    const deriver = new TimelineStateDeriver(loader);

    await deriver.run({ scenarioId: "scenario-99", leafTurnId: "leaf-1" });

    expect(loader.loadOrderedEventsAlongPath).toHaveBeenCalledWith("scenario-99", "leaf-1");
  });

  it("can skip event state collection in final mode", async () => {
    const events: RawTimelineEvent[] = [
      {
        id: "chapter",
        turnId: null,
        orderKey: "m",
        kind: "chapter_break",
        payloadVersion: 1,
        payload: { nextChapterTitle: "Prelude" },
      },
    ];
    const deriver = new TimelineStateDeriver(new StubLoader(events));

    const result = await deriver.run({ scenarioId: "scn", mode: { mode: "final" } });

    expect(result.events).toEqual([]);
    expect(result.final.chapters.chapters).toEqual([{ number: 1, title: "Prelude", turnId: null }]);
  });
});
