import type { SqliteDatabase } from "@storyforge/db";
import type {
  ChapterSummarizationContext,
  ChapterSummarizationGlobals,
  RenderContextSummarizationTarget,
} from "@storyforge/gentasks";
import { TimelineStateDeriver } from "@storyforge/timeline-events";
import { ServiceError } from "../../service-error.js";
import { loadScenarioLorebookAssignments } from "../lorebook/lorebook.queries.js";
import {
  loadScenarioCharacterContext,
  loadScenarioMetadata,
} from "../narrative/context-loaders.js";
import { attachEventsToTurns } from "../narrative/turn-utils.js";
import { getFullTimelineTurnCtx } from "../timeline/timeline.queries.js";
import { TimelineEventLoader } from "../timeline-events/loader.js";
import { eventDTOsByTurn } from "../timeline-events/utils/event-dtos.js";
import { loadChapterNodes, loadPreviousSummariesForContext } from "./chapter-summaries.queries.js";
import type { ChapterEntry, ChapterNode } from "./types.js";

export type ChapterSpan = {
  chapterEventId: string;
  closingEventId: string;
  closingTurnId: string;
  chapterNumber: number;
  title?: string;
  turnIds: string[];
  turns: ChapterSummarizationContext["turns"];
};

export type ChapterContextBuildResult = {
  node: ChapterNode;
  span: ChapterSpan;
  context: ChapterSummarizationContext;
};

/**
 * Builds chapter summarization contexts by stitching together timeline turns, derived chapter
 * metadata, lorebooks, and previously saved summaries. This builder is used by the chapter
 * summarization workflow as well as API endpoints that need to inspect or regenerate chapter
 * content.
 */
export class ChapterSummaryContextBuilder {
  private readonly loader: TimelineEventLoader;
  private readonly deriver: TimelineStateDeriver;

  constructor(private readonly db: SqliteDatabase) {
    this.loader = new TimelineEventLoader(db);
    this.deriver = new TimelineStateDeriver(this.loader);
  }

  /**
   * Builds a summarization context for the chapter that ends with the provided chapter break event.
   */
  async buildContextForClosingEvent(args: {
    scenarioId: string;
    closingEventId: string;
  }): Promise<ChapterContextBuildResult> {
    const node = await this.findChapterByClosingEvent(args.closingEventId, args.scenarioId);
    if (!node?.closing || node.chapter.chapterNumber === undefined) {
      throw new ServiceError("NotFound", {
        message: `Chapter break ${args.closingEventId} not found on active timeline`,
      });
    }
    const { span, context } = await this.buildContext({
      scenarioId: args.scenarioId,
      chapter: node.chapter,
      closing: node.closing,
    });
    return { node, span, context };
  }

  /**
   * Builds a summarization context for a specific chapter range identified by the opening and
   * closing chapter break entries. The resulting context contains the enriched turns span,
   * previously generated summaries, available lorebooks, and derived chapter metadata.
   */
  async buildContext(args: {
    scenarioId: string;
    chapter: ChapterEntry;
    closing: ChapterEntry;
  }): Promise<{ span: ChapterSpan; context: ChapterSummarizationContext }> {
    if (!args.closing.turnId) {
      throw new ServiceError("InternalError", {
        message: `Closing chapter break ${args.closing.eventId} is missing turn reference`,
      });
    }

    const timeline = await this.loadTimelineSnapshot(args.scenarioId, args.closing.turnId);
    const span = await this.buildSpan(args.scenarioId, args.chapter, args.closing, timeline.turns);

    const [charactersCtx, scenarioMeta, lorebooks, previousSummaries] = await Promise.all([
      loadScenarioCharacterContext(this.db, args.scenarioId),
      loadScenarioMetadata(this.db, args.scenarioId),
      loadScenarioLorebookAssignments(this.db, args.scenarioId),
      loadPreviousSummariesForContext(this.db, {
        scenarioId: args.scenarioId,
        closingEventId: span.closingEventId,
      }),
    ]);

    const globals: ChapterSummarizationGlobals = {
      scenarioName: scenarioMeta.name,
      scenario: scenarioMeta.description,
      currentChapterNumber: span.chapterNumber,
    };

    const target: RenderContextSummarizationTarget = {
      closingEventId: span.closingEventId,
      closingTurnId: span.closingTurnId,
      chapterNumber: span.chapterNumber,
      turnIds: span.turnIds,
      turnCount: span.turnIds.length,
    };

    const context: ChapterSummarizationContext = {
      turns: timeline.turns,
      characters: charactersCtx.characters,
      lorebooks,
      chapterSummaries: previousSummaries,
      chapters: timeline.chapters,
      globals,
      target,
    };

    return { span, context };
  }

  /**
   * Locates the chapter node whose closing entry matches the supplied event. Optionally asserts the
   * scenario to guard against cross-scenario lookups.
   */
  async findChapterByClosingEvent(
    closingEventId: string,
    expectedScenarioId?: string
  ): Promise<ChapterNode | undefined> {
    const scenarioId = await this.getScenarioIdForEvent(closingEventId);
    if (!scenarioId) return;
    if (expectedScenarioId && expectedScenarioId !== scenarioId) return;

    const nodes = await loadChapterNodes(this.db, { scenarioId });
    return nodes.find((node) => node.closing?.eventId === closingEventId);
  }

  /**
   * Computes the chapter span (inclusive turn slice and metadata) between the provided opening and
   * closing entries. When a preloaded timeline slice is supplied it is reused; otherwise this method
   * fetches and enriches the turns on demand.
   */
  async buildSpan(
    scenarioId: string,
    chapter: ChapterEntry,
    closing: ChapterEntry,
    preloadedTurns?: ChapterSummarizationContext["turns"]
  ): Promise<ChapterSpan> {
    if (!closing.turnId) {
      throw new ServiceError("InternalError", {
        message: `Closing chapter break ${closing.eventId} is missing turn reference`,
      });
    }

    const enrichedTurns =
      preloadedTurns ?? (await this.loadTimelineSnapshot(scenarioId, closing.turnId)).turns;

    const closingTurnIndex = enrichedTurns.findIndex((turn) => turn.turnId === closing.turnId);
    if (closingTurnIndex === -1) {
      throw new ServiceError("InternalError", {
        message: `Closing turn ${closing.turnId} not found on path`,
      });
    }

    let firstIndex = closingTurnIndex;
    for (let idx = closingTurnIndex; idx >= 0; idx -= 1) {
      const turn = enrichedTurns[idx];
      if (turn.chapterNumber < chapter.chapterNumber) {
        firstIndex = idx + 1;
        break;
      }
      if (idx === 0) firstIndex = 0;
    }

    const slice = enrichedTurns.slice(firstIndex, closingTurnIndex + 1);
    return {
      chapterEventId: chapter.eventId,
      closingEventId: closing.eventId,
      closingTurnId: closing.turnId,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      turnIds: slice.map((turn) => turn.turnId),
      turns: slice,
    };
  }

  /**
   * Loads the enriched turn list and derived chapter metadata for the active path leading to the
   * provided closing turn.
   */
  private async loadTimelineSnapshot(
    scenarioId: string,
    closingTurnId: string
  ): Promise<{
    turns: ChapterSummarizationContext["turns"];
    chapters: ChapterSummarizationContext["chapters"];
  }> {
    const turnsOnPath = await getFullTimelineTurnCtx(this.db, {
      scenarioId,
      leafTurnId: closingTurnId,
    });
    const derivation = await this.deriver.run({
      scenarioId,
      leafTurnId: closingTurnId,
      mode: { mode: "events" },
    });
    const eventsByTurn = eventDTOsByTurn(derivation.events);
    const turns = attachEventsToTurns(turnsOnPath, eventsByTurn);
    const chapters =
      derivation.final.chapters?.chapters.map((entry) => ({
        chapterNumber: entry.number,
        title: entry.title ?? undefined,
        breakEventId: entry.eventId,
        breakTurnId: entry.turnId,
      })) ?? [];
    return { turns, chapters };
  }

  private async getScenarioIdForEvent(eventId: string) {
    const row = await this.db.query.timelineEvents.findFirst({
      where: { id: eventId },
      columns: { scenarioId: true },
    });
    return row?.scenarioId;
  }
}
