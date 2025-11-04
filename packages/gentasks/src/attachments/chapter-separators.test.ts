import { describe, expect, it } from "vitest";
import type { ChapterContext, ChapterSummaryContext, TurnContext } from "../tasks/shared/dtos.js";
import {
  buildChapterSeparatorRenderOptions,
  buildDefaultChapterSeparatorLaneSpec,
  CHAPTER_SEPARATOR_LANE_ID,
} from "./chapter-separators.js";

let nextId = 1;

function makeTurn(overrides: Partial<TurnContext>): TurnContext {
  return {
    turnId: overrides.turnId ?? `turn-${nextId++}`,
    turnNo: overrides.turnNo ?? 1,
    chapterNumber: overrides.chapterNumber ?? 1,
    authorName: overrides.authorName ?? "Author",
    authorType: overrides.authorType ?? "character",
    content: overrides.content ?? "",
    layers: overrides.layers ?? {},
    events: overrides.events ?? [],
    intent: overrides.intent,
  };
}

describe("chapter separators", () => {
  it("returns default lane spec", () => {
    const ctx = { turns: [], chapterSummaries: [], chapters: [] } as {
      turns: TurnContext[];
      chapterSummaries: ChapterSummaryContext[];
      chapters: ChapterContext[];
    };

    const options = buildChapterSeparatorRenderOptions(ctx);
    expect(options.attachmentDefaults).toHaveLength(1);
    const lane = options.attachmentDefaults?.[0];
    const defaults = buildDefaultChapterSeparatorLaneSpec();
    expect(lane?.id).toBe(CHAPTER_SEPARATOR_LANE_ID);
    expect(lane).toMatchObject(defaults);
  });

  it("creates injections for chapter boundaries", () => {
    const turns: TurnContext[] = [
      makeTurn({ turnId: "t1", turnNo: 1, chapterNumber: 1 }),
      makeTurn({ turnId: "t2", turnNo: 2, chapterNumber: 1 }),
      makeTurn({ turnId: "t3", turnNo: 3, chapterNumber: 2 }),
      makeTurn({ turnId: "t4", turnNo: 4, chapterNumber: 2 }),
      makeTurn({ turnId: "t5", turnNo: 5, chapterNumber: 3 }),
    ];
    const summaries: ChapterSummaryContext[] = [
      { chapterNumber: 2, title: "Middle", updatedAt: new Date() },
      { chapterNumber: 3, title: "Climax", updatedAt: new Date() },
    ] as ChapterSummaryContext[];

    const chapters = [
      { chapterNumber: 1, title: "Intro", breakEventId: "ev1", breakTurnId: "t1" },
      { chapterNumber: 2, title: "Middle", breakEventId: "ev2", breakTurnId: "t3" },
      { chapterNumber: 3, title: "Climax", breakEventId: "ev3", breakTurnId: "t5" },
    ];

    const options = buildChapterSeparatorRenderOptions({
      turns,
      chapterSummaries: summaries,
      chapters,
    });
    expect(options.injections).toHaveLength(3);
    const [first, second, third] = options.injections ?? [];
    expect(first?.lane).toBe(CHAPTER_SEPARATOR_LANE_ID);
    expect(first?.target).toEqual({ kind: "at", key: "turn_1_before" });
    expect(first?.payload).toMatchObject({ chapterNumber: 1, title: "Intro" });

    expect(second?.target).toEqual({ kind: "at", key: "turn_3_before" });
    expect(second?.payload).toMatchObject({ chapterNumber: 2, title: "Middle" });

    expect(third?.target).toEqual({ kind: "at", key: "turn_5_before" });
    expect(third?.payload).toMatchObject({ chapterNumber: 3, title: "Climax" });
  });

  it("falls back to chapter metadata when no summary exists", () => {
    const turns: TurnContext[] = [
      makeTurn({ turnId: "t1", turnNo: 1, chapterNumber: 1 }),
      makeTurn({ turnId: "t2", turnNo: 2, chapterNumber: 2 }),
    ];
    const chapters: ChapterContext[] = [
      { chapterNumber: 1, title: "Prologue", breakEventId: "ev1", breakTurnId: "t1" },
      { chapterNumber: 2, title: "Act I", breakEventId: "ev2", breakTurnId: "t2" },
    ];

    const options = buildChapterSeparatorRenderOptions({
      turns,
      chapterSummaries: [],
      chapters,
    });

    const injection = options.injections?.find((entry) => entry.payload?.chapterNumber === 2);
    expect(injection?.payload).toMatchObject({ chapterNumber: 2, title: "Act I" });
  });

  it("omits separators when no preceding turn anchor exists", () => {
    const turns: TurnContext[] = [makeTurn({ turnId: "solo", turnNo: 50, chapterNumber: 7 })];

    const options = buildChapterSeparatorRenderOptions({
      turns,
      chapterSummaries: [],
      chapters: [
        { chapterNumber: 7, title: "Lonely Chapter", breakEventId: "ev", breakTurnId: "solo" },
      ],
    });
    expect(options.injections ?? []).toHaveLength(1);
  });
});
