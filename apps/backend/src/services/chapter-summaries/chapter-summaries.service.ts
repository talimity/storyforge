import { createHash } from "node:crypto";
import type {
  ChapterSummary,
  ChapterSummaryStatus,
  ChapterSummaryStatusInput,
  ChapterSummaryStatusState,
  SaveChapterSummaryInput,
  SaveChapterSummaryOutput,
  SummarizeChapterInput,
  SummarizeChapterOutput,
} from "@storyforge/contracts";
import type { ChapterSummary as ChapterSummaryRow, SqliteDatabase } from "@storyforge/db";
import { schema } from "@storyforge/db";
import type {
  ChapterSummCtx,
  ChapterSummGlobals,
  ChapterSummTarget,
  WorkflowRunHandle,
} from "@storyforge/gentasks";
import { TimelineStateDeriver } from "@storyforge/timeline-events";
import { normalizeJson } from "@storyforge/utils";
import { sql } from "drizzle-orm";
import { createChildLogger } from "../../logging.js";
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
import { getWorkflowForTaskScope } from "../workflows/workflow.queries.js";
import { WorkflowRunnerManager } from "../workflows/workflow-runner-manager.js";
import { loadChapterNodes, loadPreviousSummariesForContext } from "./chapter-summaries.queries.js";
import { type ChapterSummaryRunRecord, getChapterSummaryRunManager } from "./run-manager.js";
import type { ChapterEntry, ChapterNode } from "./types.js";

const { chapterSummaries, turns, turnLayers } = schema;
const log = createChildLogger("chapter-summaries");

const SUMMARY_TEXT_KEY = "summary_text";
const SUMMARY_JSON_KEY = "summary_json";

type ChapterSpan = {
  chapterEventId: string;
  closingEventId: string;
  closingTurnId: string;
  chapterNumber: number;
  title: string | null;
  turnIds: string[];
  turns: ChapterSummCtx["turns"];
};

type FingerprintMeta = {
  turnCount: number;
  maxTurnUpdatedAt: Date;
  spanFingerprint: string;
};

export class ChapterSummariesService {
  private readonly loader: TimelineEventLoader;
  private readonly deriver: TimelineStateDeriver;

  constructor(private readonly db: SqliteDatabase) {
    this.loader = new TimelineEventLoader(db);
    this.deriver = new TimelineStateDeriver(this.loader);
  }

  async getSummary(closingEventId: string): Promise<ChapterSummary | null> {
    const pair = await this.findChapterByClosingEvent(closingEventId);
    if (!pair?.closing) return null;

    const row = await this.db.query.chapterSummaries.findFirst({ where: { closingEventId } });
    if (!row) return null;

    return this.toSummaryDTO(row, pair.chapter, pair.closing);
  }

  async getStatus(args: ChapterSummaryStatusInput): Promise<ChapterSummaryStatus> {
    const nodes = await loadChapterNodes(this.db, args);
    const node = nodes.find((node) => node.chapter.eventId === args.chapterEventId);
    if (!node) {
      throw new ServiceError("NotFound", {
        message: `Chapter ${args.chapterEventId} not found on active timeline`,
      });
    }
    return this.buildStatusForNode(args.scenarioId, node);
  }

  async listForPath(args: {
    scenarioId: string;
    leafTurnId?: string | null;
  }): Promise<ChapterSummaryStatus[]> {
    const nodes = await loadChapterNodes(this.db, args);
    const statuses: ChapterSummaryStatus[] = [];
    for (const node of nodes) {
      statuses.push(await this.buildStatusForNode(args.scenarioId, node));
    }
    return statuses;
  }

  async summarizeChapter(args: SummarizeChapterInput): Promise<SummarizeChapterOutput> {
    const pair = await this.findChapterByClosingEvent(args.closingEventId);
    if (!pair?.closing) {
      throw new ServiceError("NotFound", {
        message: `Chapter break ${args.closingEventId} not found on active timeline`,
      });
    }

    const runManager = getChapterSummaryRunManager();
    const activeRun = runManager.getByClosingEvent(args.closingEventId);
    if (activeRun && !args.force && !activeRun.finishedAt) {
      return { runId: activeRun.runId };
    }

    const span = await this.buildSpan(args.scenarioId, pair.chapter, pair.closing);
    const fingerprint = await this.computeFingerprint(args.scenarioId, span);

    const existingSummary = await this.db.query.chapterSummaries.findFirst({
      where: { closingEventId: args.closingEventId },
    });

    if (existingSummary && !args.force) {
      const status = await this.computeStatus({
        scenarioId: args.scenarioId,
        node: pair,
        span,
        summary: existingSummary,
        fingerprint,
        run: undefined,
      });
      if (status.state === "ready") {
        throw new ServiceError("InvalidInput", {
          message: "Chapter summary is already up to date.",
        });
      }
    }

    const previousSummaries = await loadPreviousSummariesForContext(this.db, {
      scenarioId: args.scenarioId,
      closingEventId: args.closingEventId,
    });

    const [charactersCtx, scenarioMeta, lorebooks] = await Promise.all([
      loadScenarioCharacterContext(this.db, args.scenarioId),
      loadScenarioMetadata(this.db, args.scenarioId),
      loadScenarioLorebookAssignments(this.db, args.scenarioId),
    ]);

    const globals: ChapterSummGlobals = {
      scenarioName: scenarioMeta.name,
      scenario: scenarioMeta.description,
    };

    const target: ChapterSummTarget = {
      closingEventId: span.closingEventId,
      closingTurnId: span.closingTurnId,
      chapterNumber: span.chapterNumber,
      turnIds: span.turnIds,
      turnCount: span.turnIds.length,
    };

    const context: ChapterSummCtx = {
      turns: span.turns,
      characters: charactersCtx.characters,
      lorebooks,
      chapterSummaries: previousSummaries,
      globals,
      target,
    };

    const workflow = await getWorkflowForTaskScope(this.db, "chapter_summarization", {
      scenarioId: args.scenarioId,
    });
    const runner = WorkflowRunnerManager.getInstance(this.db).getRunner("chapter_summarization");
    const handle = await runner.startRun(workflow, context);
    runManager.track(args.closingEventId, args.scenarioId, handle);

    void this.persistOnCompletion({
      handle,
      span,
      fingerprint,
      workflowId: workflow.id,
      scenarioId: args.scenarioId,
    });

    return { runId: handle.id };
  }

  async bulkSummarizeMissing(args: {
    scenarioId: string;
    leafTurnId?: string | null;
    force?: boolean;
  }): Promise<{ enqueued: number; runIds: string[] }> {
    const statuses = await this.listForPath(args);

    const runIds: string[] = [];
    for (const status of statuses) {
      if (!status.closingEventId) continue;
      if (status.state === "ready" && !args.force) continue;
      if (status.state === "running") {
        if (status.runId) runIds.push(status.runId);
        continue;
      }
      const { runId } = await this.summarizeChapter({
        scenarioId: args.scenarioId,
        closingEventId: status.closingEventId,
        force: args.force,
      });
      runIds.push(runId);
    }
    return { enqueued: runIds.length, runIds };
  }

  async saveSummary(args: SaveChapterSummaryInput): Promise<SaveChapterSummaryOutput["summary"]> {
    const pair = await this.findChapterByClosingEvent(args.closingEventId);
    if (!pair?.closing) {
      throw new ServiceError("NotFound", {
        message: `Chapter break ${args.closingEventId} not found on active timeline`,
      });
    }

    const span = await this.buildSpan(args.scenarioId, pair.chapter, pair.closing);
    const fingerprint = await this.computeFingerprint(args.scenarioId, span);
    const summaryJson = normalizeJson(args.summaryJson);

    await this.db.transaction(async (tx) => {
      await tx
        .insert(chapterSummaries)
        .values({
          scenarioId: args.scenarioId,
          chapterNumber: span.chapterNumber,
          closingEventId: span.closingEventId,
          closingTurnId: span.closingTurnId,
          summaryText: args.summaryText,
          summaryJson,
          turnCount: fingerprint.turnCount,
          maxTurnUpdatedAt: fingerprint.maxTurnUpdatedAt,
          spanFingerprint: fingerprint.spanFingerprint,
          workflowId: null,
          modelProfileId: null,
        })
        .onConflictDoUpdate({
          target: chapterSummaries.closingEventId,
          set: {
            chapterNumber: span.chapterNumber,
            summaryText: args.summaryText,
            summaryJson,
            turnCount: fingerprint.turnCount,
            maxTurnUpdatedAt: fingerprint.maxTurnUpdatedAt,
            spanFingerprint: fingerprint.spanFingerprint,
            workflowId: null,
            modelProfileId: null,
            updatedAt: new Date(),
          },
        });
    });

    const row = await this.db.query.chapterSummaries.findFirst({
      where: { closingEventId: args.closingEventId },
    });
    if (!row) {
      throw new ServiceError("InternalError", { message: "Failed to load saved chapter summary" });
    }
    return this.toSummaryDTO(row, pair.chapter, pair.closing);
  }

  private async getScenarioIdForEvent(eventId: string) {
    const row = await this.db.query.timelineEvents.findFirst({
      where: { id: eventId },
      columns: { scenarioId: true },
    });
    return row?.scenarioId;
  }

  private async findChapterByClosingEvent(closingEventId: string) {
    const scenarioId = await this.getScenarioIdForEvent(closingEventId);
    if (!scenarioId) return null;
    const nodes = await loadChapterNodes(this.db, { scenarioId });
    return nodes.find((node) => node.closing?.eventId === closingEventId);
  }

  private async buildStatusForNode(
    scenarioId: string,
    node: ChapterNode
  ): Promise<ChapterSummaryStatus> {
    if (!node.closing) {
      return {
        chapterEventId: node.chapter.eventId,
        closingEventId: null,
        closingTurnId: null,
        chapterNumber: node.chapter.chapterNumber,
        title: node.chapter.title,
        state: "current",
        summaryId: null,
        updatedAt: null,
        turnCount: null,
        workflowId: null,
        modelProfileId: null,
        runId: null,
        lastError: null,
      };
    }

    const [span, summary, run] = await Promise.all([
      this.buildSpan(scenarioId, node.chapter, node.closing),
      this.db.query.chapterSummaries.findFirst({
        where: { closingEventId: node.closing.eventId },
      }),
      Promise.resolve(getChapterSummaryRunManager().getByClosingEvent(node.closing.eventId)),
    ]);

    const fingerprint = summary ? await this.computeFingerprint(scenarioId, span) : undefined;

    return this.computeStatus({ scenarioId, node, span, summary, fingerprint, run });
  }

  private async buildSpan(
    scenarioId: string,
    chapter: ChapterEntry,
    closing: ChapterEntry
  ): Promise<ChapterSpan> {
    if (!closing.turnId) {
      throw new ServiceError("InternalError", {
        message: `Closing chapter break ${closing.eventId} is missing turn reference`,
      });
    }

    const turnsOnPath = await getFullTimelineTurnCtx(this.db, {
      scenarioId,
      leafTurnId: closing.turnId,
    });
    const derivation = await this.deriver.run({
      scenarioId,
      leafTurnId: closing.turnId,
      mode: { mode: "events" },
    });
    const eventsByTurn = eventDTOsByTurn(derivation.events);
    const enrichedTurns = attachEventsToTurns(turnsOnPath, eventsByTurn);

    const closingTurnIndex = enrichedTurns.findIndex((turn) => turn.turnId === closing.turnId);
    if (closingTurnIndex === -1) {
      throw new ServiceError("InternalError", {
        message: `Closing turn ${closing.turnId} not found on path`,
      });
    }

    let startIndex = 0;
    if (chapter.turnId) {
      const idx = enrichedTurns.findIndex((turn) => turn.turnId === chapter.turnId);
      if (idx !== -1) startIndex = idx;
    }

    const slice = enrichedTurns.slice(startIndex, closingTurnIndex + 1);
    const turnIds = slice.map((turn) => turn.turnId);

    return {
      chapterEventId: chapter.eventId,
      closingEventId: closing.eventId,
      closingTurnId: closing.turnId,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      turnIds,
      turns: slice,
    };
  }

  private async computeFingerprint(
    scenarioId: string,
    span: ChapterSpan
  ): Promise<FingerprintMeta> {
    if (span.turnIds.length === 0) {
      return {
        turnCount: 0,
        maxTurnUpdatedAt: new Date(0),
        spanFingerprint: `${span.chapterEventId}::${span.closingEventId}`,
      };
    }

    const placeholders = span.turnIds.map((id) => sql`${id}`);
    const rows = await this.db.all<{ turnId: string; updatedAt: number }>(
      sql`
        SELECT t.id AS turnId,
               COALESCE(l.updated_at, t.updated_at) AS updatedAt
        FROM ${turns} t
        LEFT JOIN ${turnLayers} l ON l.turn_id = t.id AND l.key = 'presentation'
        WHERE t.id IN (${sql.join(placeholders, sql`, `)})
          AND t.scenario_id = ${scenarioId};
      `
    );

    const updatedMap = new Map<string, number>();
    for (const row of rows) {
      updatedMap.set(row.turnId, typeof row.updatedAt === "number" ? row.updatedAt : 0);
    }

    let maxUpdatedAt = 0;
    const hash = createHash("sha256");
    hash.update(span.chapterEventId);
    hash.update("::");
    hash.update(span.closingEventId);
    for (const turnId of span.turnIds) {
      const updatedAt = updatedMap.get(turnId) ?? 0;
      if (updatedAt > maxUpdatedAt) maxUpdatedAt = updatedAt;
      hash.update("|");
      hash.update(turnId);
      hash.update(":");
      hash.update(String(updatedAt));
    }

    return {
      turnCount: span.turnIds.length,
      maxTurnUpdatedAt: new Date(maxUpdatedAt),
      spanFingerprint: hash.digest("hex"),
    };
  }

  private async computeStatus(args: {
    scenarioId: string;
    node: ChapterNode;
    span: ChapterSpan;
    summary?: ChapterSummaryRow;
    fingerprint?: FingerprintMeta;
    run?: ChapterSummaryRunRecord;
  }): Promise<ChapterSummaryStatus> {
    const { node, span, summary, fingerprint, run } = args;
    const currentTurnCount = fingerprint?.turnCount ?? span.turnIds.length;

    const base: Omit<ChapterSummaryStatus, "state"> = {
      chapterEventId: node.chapter.eventId,
      closingEventId: span.closingEventId,
      closingTurnId: span.closingTurnId,
      chapterNumber: span.chapterNumber,
      title: node.chapter.title,
      summaryId: summary?.id ?? null,
      updatedAt: summary?.updatedAt ?? null,
      turnCount: currentTurnCount,
      workflowId: summary?.workflowId ?? null,
      modelProfileId: summary?.modelProfileId ?? null,
      runId: run?.runId ?? null,
      lastError: run?.error ?? null,
    };

    if (run && !run.finishedAt) {
      return { ...base, state: "running" };
    }

    if (!summary) {
      if (run?.finishedAt && run.error) {
        return { ...base, state: "error", lastError: run.error };
      }
      return { ...base, state: "missing" };
    }

    const staleReasons: string[] = [];
    if (fingerprint) {
      if (summary.turnCount !== fingerprint.turnCount) {
        staleReasons.push("turn_count_changed");
      } else if (summary.spanFingerprint !== fingerprint.spanFingerprint) {
        staleReasons.push("fingerprint_mismatch");
      } else if (summary.maxTurnUpdatedAt.getTime() !== fingerprint.maxTurnUpdatedAt.getTime()) {
        staleReasons.push("turn_updated_at_changed");
      }
    }

    const state: ChapterSummaryStatusState = staleReasons.length ? "stale" : "ready";

    return {
      ...base,
      staleReasons: staleReasons.length ? staleReasons : undefined,
      state,
    };
  }

  private toSummaryDTO(
    row: ChapterSummaryRow,
    chapter: ChapterEntry,
    closing: ChapterEntry
  ): ChapterSummary {
    const summaryJson = normalizeJson(row.summaryJson);

    return {
      id: row.id,
      scenarioId: row.scenarioId,
      chapterEventId: chapter.eventId,
      closingEventId: closing.eventId,
      closingTurnId: closing.turnId,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      summaryText: row.summaryText,
      summaryJson,
      turnCount: row.turnCount,
      maxTurnUpdatedAt: row.maxTurnUpdatedAt,
      spanFingerprint: row.spanFingerprint,
      workflowId: row.workflowId,
      modelProfileId: row.modelProfileId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async persistOnCompletion(args: {
    handle: WorkflowRunHandle;
    span: ChapterSpan;
    fingerprint: FingerprintMeta;
    workflowId: string;
    scenarioId: string;
  }) {
    try {
      const result = await args.handle.result;
      const text = result.finalOutputs[SUMMARY_TEXT_KEY];
      if (typeof text !== "string" || text.trim().length === 0) {
        throw new Error("Workflow did not produce chapter summary text output");
      }
      const rawStructured = result.finalOutputs[SUMMARY_JSON_KEY];
      const structured = normalizeJson(rawStructured);
      await this.db.transaction(async (tx) => {
        await tx
          .insert(chapterSummaries)
          .values({
            scenarioId: args.scenarioId,
            chapterNumber: args.span.chapterNumber,
            closingEventId: args.span.closingEventId,
            closingTurnId: args.span.closingTurnId,
            summaryText: text,
            summaryJson: structured,
            turnCount: args.fingerprint.turnCount,
            maxTurnUpdatedAt: args.fingerprint.maxTurnUpdatedAt,
            spanFingerprint: args.fingerprint.spanFingerprint,
            workflowId: args.workflowId,
          })
          .onConflictDoUpdate({
            target: chapterSummaries.closingEventId,
            set: {
              chapterNumber: args.span.chapterNumber,
              summaryText: text,
              summaryJson: structured,
              turnCount: args.fingerprint.turnCount,
              maxTurnUpdatedAt: args.fingerprint.maxTurnUpdatedAt,
              spanFingerprint: args.fingerprint.spanFingerprint,
              workflowId: args.workflowId,
              updatedAt: new Date(),
            },
          });
      });
    } catch (error) {
      log.error(
        { err: error, closingEventId: args.span.closingEventId, scenarioId: args.scenarioId },
        "Chapter summary run failed"
      );
    }
  }
}
