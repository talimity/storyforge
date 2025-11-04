import { describe, expect, it } from "vitest";
import type { TurnContext } from "../dtos.js";
import { applyChapterWindow } from "./chapter-window.js";

function buildTurns(turnsPerChapter: number[], chapterStart = 1): TurnContext[] {
  const turns: TurnContext[] = [];
  let turnNo = 1;
  let chapterNumber = chapterStart;
  for (const count of turnsPerChapter) {
    for (let i = 0; i < count; i += 1) {
      turns.push({
        turnId: `turn-${turnNo}`,
        turnNo,
        chapterNumber,
        authorName: "Narrator",
        authorType: "narrator",
        content: `Turn ${turnNo}`,
        layers: {},
        events: [],
      });
      turnNo += 1;
    }
    chapterNumber += 1;
  }
  return turns;
}

describe("applyChapterWindow", () => {
  const turns = buildTurns([5, 5, 5, 5]);

  it("defaults to the original array when no window is provided", () => {
    expect(applyChapterWindow(turns)).toEqual(turns);
  });

  it("selects only the current chapter when offsets are zero", () => {
    const result = applyChapterWindow(turns, { startOffset: 0, endOffset: 0 });
    expect(result.map((t) => t.turnNo)).toEqual([16, 17, 18, 19, 20]);
  });

  it("selects prior chapters using negative offsets", () => {
    const result = applyChapterWindow(turns, { startOffset: -2, endOffset: -1 });
    expect(result.map((t) => t.turnNo)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it("selects earliest chapters using positive offsets", () => {
    const result = applyChapterWindow(turns, { startOffset: 1, endOffset: 2 });
    expect(result.map((t) => t.turnNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("expands toward older chapters to satisfy minTurns for recent ranges", () => {
    const result = applyChapterWindow(turns, {
      startOffset: 0,
      endOffset: 0,
      minTurns: 8,
    });
    expect(result.map((t) => t.turnNo)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it("expands toward newer chapters to satisfy minTurns for historical ranges", () => {
    const result = applyChapterWindow(turns, {
      startOffset: 1,
      endOffset: 1,
      minTurns: 8,
    });
    expect(result.map((t) => t.turnNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("clamps to available chapters when offsets exceed bounds", () => {
    const result = applyChapterWindow(turns, {
      startOffset: -10,
      endOffset: 10,
    });
    expect(result).toEqual(turns);
  });

  it("returns empty when requesting prior chapters but none exist", () => {
    const singleChapterTurns = buildTurns([5]);
    const result = applyChapterWindow(singleChapterTurns, {
      startOffset: -1,
      endOffset: 1,
    });
    expect(result).toHaveLength(0);
  });
});
