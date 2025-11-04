import type { TurnContext } from "../dtos.js";

export type ChapterWindow = {
  startOffset?: number;
  endOffset?: number;
  minTurns?: number;
};

export function applyChapterWindow(turns: TurnContext[], window?: ChapterWindow): TurnContext[] {
  if (!window || turns.length === 0) {
    return [...turns];
  }

  const chapterNumbers = extractChapterNumbers(turns);
  if (chapterNumbers.length === 0) {
    return [];
  }

  const earliestChapter = chapterNumbers[0];
  const latestChapter = chapterNumbers[chapterNumbers.length - 1];

  const startOffset = window.startOffset ?? Number.NEGATIVE_INFINITY;
  const endOffset = window.endOffset ?? 0;

  let startChapter = resolveOffset(startOffset, earliestChapter, latestChapter);
  let endChapter = resolveOffset(endOffset, earliestChapter, latestChapter);

  startChapter = clampChapter(startChapter, earliestChapter, latestChapter);
  endChapter = clampChapter(endChapter, earliestChapter, latestChapter);

  let lowIndex = chapterToIndex(Math.min(startChapter, endChapter), chapterNumbers);
  let highIndex = chapterToIndex(Math.max(startChapter, endChapter), chapterNumbers);

  const grouped = groupTurnsByChapter(turns);
  let selected = collectTurns(chapterNumbers, grouped, lowIndex, highIndex);

  const minTurns = Math.max(0, window.minTurns ?? 0);
  if (minTurns > 0 && selected.length < minTurns) {
    const preferOlder = startOffset <= 0 && endOffset <= 0;
    const preferNewer = startOffset >= 0 && endOffset >= 0;

    while (selected.length < minTurns) {
      const canExpandOlder = lowIndex > 0;
      const canExpandNewer = highIndex < chapterNumbers.length - 1;

      let expanded = false;

      if (preferOlder && canExpandOlder) {
        lowIndex -= 1;
        expanded = true;
      } else if (preferNewer && canExpandNewer) {
        highIndex += 1;
        expanded = true;
      } else if (canExpandOlder) {
        lowIndex -= 1;
        expanded = true;
      } else if (canExpandNewer) {
        highIndex += 1;
        expanded = true;
      }

      if (!expanded) {
        break;
      }

      selected = collectTurns(chapterNumbers, grouped, lowIndex, highIndex);
    }
  }

  return selected;
}

function extractChapterNumbers(turns: TurnContext[]): number[] {
  const chapters: number[] = [];
  let lastChapter: number | undefined;
  for (const turn of turns) {
    if (turn.chapterNumber !== lastChapter) {
      chapters.push(turn.chapterNumber);
      lastChapter = turn.chapterNumber;
    }
  }
  return chapters;
}

function resolveOffset(offset: number, earliest: number, latest: number): number {
  if (!Number.isFinite(offset)) {
    return offset < 0 ? earliest : latest;
  }

  const normalized = Math.trunc(offset);
  if (normalized <= 0) {
    return latest + normalized;
  }

  return earliest + (normalized - 1);
}

function clampChapter(chapter: number, earliest: number, latest: number): number {
  if (!Number.isFinite(chapter)) {
    return chapter < 0 ? earliest : latest;
  }
  if (chapter < earliest) return earliest;
  if (chapter > latest) return latest;
  return chapter;
}

function chapterToIndex(chapter: number, chapters: readonly number[]): number {
  const earliest = chapters[0];
  const latest = chapters[chapters.length - 1];
  if (chapter <= earliest) return 0;
  if (chapter >= latest) return chapters.length - 1;
  const exactIndex = chapters.indexOf(chapter);
  if (exactIndex !== -1) {
    return exactIndex;
  }
  for (let i = 0; i < chapters.length; i += 1) {
    if (chapters[i] > chapter) {
      return i;
    }
  }
  return chapters.length - 1;
}

function groupTurnsByChapter(turns: TurnContext[]): Map<number, TurnContext[]> {
  const grouped = new Map<number, TurnContext[]>();
  for (const turn of turns) {
    const existing = grouped.get(turn.chapterNumber);
    if (existing) {
      existing.push(turn);
    } else {
      grouped.set(turn.chapterNumber, [turn]);
    }
  }
  return grouped;
}

function collectTurns(
  chapterNumbers: readonly number[],
  grouped: Map<number, TurnContext[]>,
  lowIndex: number,
  highIndex: number
): TurnContext[] {
  const result: TurnContext[] = [];
  for (let idx = lowIndex; idx <= highIndex; idx += 1) {
    const chapter = chapterNumbers[idx];
    const turns = grouped.get(chapter);
    if (turns) {
      result.push(...turns);
    }
  }
  return result;
}
