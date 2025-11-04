import type {
  AttachmentLaneSpec,
  InjectionRequest,
  RenderOptions,
} from "@storyforge/prompt-rendering";
import type { NarrativeContext } from "../tasks/shared/context.js";
import type { ChapterContext, ChapterSummaryContext, TurnContext } from "../tasks/shared/dtos.js";

type ChapterSeparatorContext = Pick<NarrativeContext, "turns" | "chapterSummaries" | "chapters">;

type ChapterSeparatorPayload = {
  chapterNumber: number;
  title?: string;
  turnId: string;
  turnNo: number;
};

export const CHAPTER_SEPARATOR_LANE_ID = "chapter_separators";

/**
 * Returns the default attachment spec for chapter separators.
 */
export function buildDefaultChapterSeparatorLaneSpec(): AttachmentLaneSpec {
  return {
    id: CHAPTER_SEPARATOR_LANE_ID,
    enabled: true,
    role: "system",
    order: 40,
    template:
      "\n## Chapter {{payload.chapterNumber}}{{#if payload.title}}: {{payload.title}}{{#endif}}\n",
    groups: [{ match: "^turn_", openTemplate: undefined, closeTemplate: undefined }],
  };
}

/**
 * Builds prompt template render options for chapter separators.
 */
export function buildChapterSeparatorRenderOptions(ctx: ChapterSeparatorContext): RenderOptions {
  const laneSpec = buildDefaultChapterSeparatorLaneSpec();
  const injections = buildChapterSeparatorInjections(ctx.turns, ctx.chapterSummaries, ctx.chapters);

  return {
    attachmentDefaults: [laneSpec],
    ...(injections.length > 0 ? { injections } : {}),
  };
}

/**
 * Given a list of turns, chapter summaries, and derived chapter metadata, builds injection requests
 * for chapter separators placed before the first turn of each chapter. When a chapter is missing a
 * stored summary the derived chapter title is used instead so separators remain descriptive.
 */
function buildChapterSeparatorInjections(
  turns: TurnContext[],
  summaries: ChapterSummaryContext[] | undefined,
  chapters: ChapterContext[] | undefined
): InjectionRequest[] {
  if (turns.length === 0) {
    return [];
  }

  const ordered = [...turns].sort((a, b) => a.turnNo - b.turnNo);
  const summaryByNumber = new Map<number, ChapterSummaryContext>();
  for (const summary of summaries ?? []) {
    summaryByNumber.set(summary.chapterNumber, summary);
  }
  const chapterByNumber = new Map<number, ChapterContext>();
  for (const chapter of chapters ?? []) {
    chapterByNumber.set(chapter.chapterNumber, chapter);
  }

  const firstTurnByChapter = new Map<number, TurnContext>();
  for (const turn of ordered) {
    if (!firstTurnByChapter.has(turn.chapterNumber)) {
      firstTurnByChapter.set(turn.chapterNumber, turn);
    }
  }

  const injections: InjectionRequest[] = [];
  for (const [, firstTurn] of firstTurnByChapter) {
    // place the separator at the `before` anchor of the first turn in the
    // chapter; we do this rather than looking for the previous turn's `after`
    // anchor since the previous turn may not exist (ch1) or may not be in scope
    const targetKey = `turn_${firstTurn.turnNo}_before`;

    const summary = summaryByNumber.get(firstTurn.chapterNumber);
    const payload: ChapterSeparatorPayload = {
      chapterNumber: firstTurn.chapterNumber,
      title: summary?.title ?? chapterByNumber.get(firstTurn.chapterNumber)?.title,
      turnId: firstTurn.turnId,
      turnNo: firstTurn.turnNo,
    };

    injections.push({
      lane: CHAPTER_SEPARATOR_LANE_ID,
      target: { kind: "at", key: targetKey },
      payload,
      priority: payload.chapterNumber,
      groupId: targetKey,
    });
  }

  return injections;
}
