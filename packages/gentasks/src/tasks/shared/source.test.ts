import { describe, expect, it } from "vitest";
import type { NarrativeContext } from "./context.js";
import type { TurnContext } from "./dtos.js";
import { makeNarrativeSourceHandlers } from "./source.js";
import type { ChapterWindow } from "./utils/chapter-window.js";

type TurnsSourceArgs = {
  start?: number;
  end?: number;
  chapterWindow?: ChapterWindow;
};

const handlers = makeNarrativeSourceHandlers<NarrativeContext>();

const resolveTurns = (ctx: NarrativeContext, args?: TurnsSourceArgs) =>
  handlers.turns({ source: "turns", args }, ctx);

const buildTurns = (count: number, turnsPerChapter: number): TurnContext[] =>
  Array.from({ length: count }, (_, index) => {
    const turnNo = index + 1;
    return {
      turnId: `turn-${turnNo}`,
      turnNo,
      chapterNumber: Math.ceil(turnNo / turnsPerChapter),
      authorName: "Narrator",
      authorType: "narrator",
      content: `Turn ${turnNo}`,
      layers: {},
      events: [],
    };
  });

const BASE_TURN_COUNT = 100;
const TURNS_PER_CHAPTER = 25;
const baseTurns = buildTurns(BASE_TURN_COUNT, TURNS_PER_CHAPTER);
const baseChapters = Array.from({ length: BASE_TURN_COUNT / TURNS_PER_CHAPTER }, (_, index) => ({
  chapterNumber: index + 1,
  title: `Chapter ${index + 1}`,
  breakEventId: `event-${index + 1}`,
  breakTurnId: null,
}));

const baseContext: NarrativeContext = {
  turns: baseTurns,
  characters: [],
  lorebooks: [],
  chapterSummaries: [],
  chapters: baseChapters,
};

describe("makeNarrativeSourceHandlers - turns source", () => {
  it("returns all turns newest-first when no chapter limit is applied", () => {
    const turns = resolveTurns(baseContext);

    expect(turns).toHaveLength(BASE_TURN_COUNT);
    expect(turns[0]?.turnNo).toBe(100);
    expect(turns.at(-1)?.turnNo).toBe(1);
  });

  it("limits turns to the current chapter when window is zero", () => {
    const turns = resolveTurns(baseContext, {
      chapterWindow: { startOffset: 0, endOffset: 0 },
    });

    expect(turns).toHaveLength(TURNS_PER_CHAPTER);
    expect(turns[0]?.turnNo).toBe(100);
    expect(turns.at(-1)?.turnNo).toBe(76);
  });

  it("extends the window to satisfy minTurns when needed", () => {
    const turns = resolveTurns(baseContext, {
      chapterWindow: { startOffset: 0, endOffset: 0, minTurns: 30 },
    });

    expect(turns).toHaveLength(TURNS_PER_CHAPTER * 2);
    expect(turns[0]?.turnNo).toBe(100);
    expect(turns.at(-1)?.turnNo).toBe(51);
  });

  it("includes additional past chapters when minTurns exceeds the chapter limit window", () => {
    const turns = resolveTurns(baseContext, {
      chapterWindow: { startOffset: -1, endOffset: 0, minTurns: BASE_TURN_COUNT },
    });

    expect(turns).toHaveLength(BASE_TURN_COUNT);
    expect(turns[0]?.turnNo).toBe(100);
    expect(turns.at(-1)?.turnNo).toBe(1);
  });

  it("applies start and end slicing after chapter limiting", () => {
    const turns = resolveTurns(baseContext, {
      chapterWindow: { startOffset: 0, endOffset: 0 },
      start: 0,
      end: 4,
    });

    expect(turns).toHaveLength(5);
    expect(turns[0]?.turnNo).toBe(80);
    expect(turns.at(-1)?.turnNo).toBe(76);
  });

  it("treats positive offsets as chapter indices from the start", () => {
    const turns = resolveTurns(baseContext, {
      chapterWindow: { startOffset: 1, endOffset: 2 },
    });

    expect(turns).toHaveLength(TURNS_PER_CHAPTER * 2);
    expect(turns[0]?.turnNo).toBe(50);
    expect(turns.at(-1)?.turnNo).toBe(1);
  });

  it("expands toward newer chapters when targeting historical windows with minTurns", () => {
    const turns = resolveTurns(baseContext, {
      chapterWindow: { startOffset: 1, endOffset: 2, minTurns: 70 },
    });

    expect(turns).toHaveLength(75);
    expect(turns[0]?.turnNo).toBe(75);
    expect(turns.at(-1)?.turnNo).toBe(1);
  });
});
