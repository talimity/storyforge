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
  it("reduces events into final state and emits hints", async () => {
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

    const firstHint = result.hints.get("init-chapter");
    expect(firstHint?.chapters).toEqual({ chapterNumber: 1 });
    const secondHint = result.hints.get("chapter-2");
    expect(secondHint?.chapters).toEqual({ chapterNumber: 2 });

    expect(result.hints.get("presence-1")).toBeUndefined();
  });

  it("passes scenario and leaf IDs to the loader", async () => {
    const loader: TimelineEventDataLoader = {
      loadOrderedEventsAlongPath: vi.fn().mockResolvedValue([]),
    };
    const deriver = new TimelineStateDeriver(loader);

    await deriver.run({ scenarioId: "scenario-99", leafTurnId: "leaf-1" });

    expect(loader.loadOrderedEventsAlongPath).toHaveBeenCalledWith("scenario-99", "leaf-1");
  });
});
