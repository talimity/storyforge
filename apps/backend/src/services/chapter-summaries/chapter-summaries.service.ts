import { createHash } from "node:crypto";
import { type ChapterSummary, type SqliteDatabase, schema } from "@storyforge/db";
import type {
  ChapterSummaryCtxEntry,
  ChapterSummCtx,
  ChapterSummGlobals,
  ChapterSummTarget,
  WorkflowRunHandle,
} from "@storyforge/gentasks";
import { TimelineStateDeriver } from "@storyforge/timeline-events";
import { inArray, sql } from "drizzle-orm";
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
import { type ChapterSummaryRunRecord, getChapterSummaryRunManager } from "./run-manager.js";
import type {
  ChapterDescriptor,
  ChapterSpan,
  ChapterSummaryRecord,
  ChapterSummaryStatus,
  ChapterSummaryStatusState,
} from "./types.js";

const { chapterSummaries, turns, turnLayers } = schema;
const log = createChildLogger("chapter-summaries");

const SUMMARY_TEXT_KEY = "summary_text";
const SUMMARY_JSON_KEY = "summary_json";

type FingerprintMeta = {
  turnCount: number;
  maxTurnUpdatedAt: number;
  spanFingerprint: string;
};

export class ChapterSummariesService {
  private readonly loader: TimelineEventLoader;
  private readonly deriver: TimelineStateDeriver;

  constructor(private readonly db: SqliteDatabase) {
    this.loader = new TimelineEventLoader(db);
    this.deriver = new TimelineStateDeriver(this.loader);
  }

  async getSummary(closingEventId: string): Promise<ChapterSummaryRecord | null> {
    const row = await this.db.query.chapterSummaries.findFirst({
      where: { closingEventId },
    });
    if (!row) return null;
    const title = await this.resolveChapterTitle(row.scenarioId, closingEventId, row.closingTurnId);
    return { ...row, title };
  }

  async getStatus(args: {
    scenarioId: string;
    closingEventId: string;
  }): Promise<ChapterSummaryStatus> {
    const descriptors = await this.loadChapterDescriptors(args.scenarioId, null);
    const descriptor = descriptors.find((d) => d.eventId === args.closingEventId);
    if (!descriptor || !descriptor.turnId) {
      throw new ServiceError("NotFound", {
        message: `Chapter break ${args.closingEventId} not found on active timeline`,
      });
    }

    const span = await this.buildSpan({
      scenarioId: args.scenarioId,
      descriptor,
      closingTurnId: descriptor.turnId,
    });

    const summaryRow = await this.db.query.chapterSummaries.findFirst({
      where: { closingEventId: args.closingEventId },
    });
    const runRecord = getChapterSummaryRunManager().getByClosingEvent(args.closingEventId);
    const fingerprint = summaryRow
      ? await this.computeFingerprint(args.scenarioId, span)
      : undefined;

    return this.computeStatus({
      span,
      summary: summaryRow ? { ...summaryRow, title: descriptor.title } : null,
      run: runRecord,
      fingerprint,
    });
  }

  async listForPath(args: {
    scenarioId: string;
    leafTurnId?: string | null;
  }): Promise<ChapterSummaryStatus[]> {
    const descriptors = await this.loadChapterDescriptors(args.scenarioId, args.leafTurnId ?? null);
    const relevant = descriptors.filter((d) => d.turnId !== null);
    if (relevant.length === 0) return [];

    const eventIds = relevant.map((d) => d.eventId);
    const rows =
      eventIds.length > 0
        ? await this.db
            .select()
            .from(chapterSummaries)
            .where(inArray(chapterSummaries.closingEventId, eventIds))
        : [];

    const summariesByEvent = new Map<string, ChapterSummary>();
    for (const row of rows) summariesByEvent.set(row.closingEventId, row);

    const runManager = getChapterSummaryRunManager();
    const statuses: ChapterSummaryStatus[] = [];
    for (const descriptor of relevant) {
      const span = await this.buildSpan({
        scenarioId: args.scenarioId,
        descriptor,
        closingTurnId: descriptor.turnId as string,
      });
      const summaryRow = summariesByEvent.get(descriptor.eventId);
      const run = runManager.getByClosingEvent(descriptor.eventId);
      const fingerprint = summaryRow
        ? await this.computeFingerprint(args.scenarioId, span)
        : undefined;
      statuses.push(
        this.computeStatus({
          span,
          summary: summaryRow ? { ...summaryRow, title: descriptor.title } : null,
          run,
          fingerprint,
        })
      );
    }
    return statuses;
  }

  async summarizeChapter(args: {
    scenarioId: string;
    closingEventId: string;
    force?: boolean;
  }): Promise<{ runId: string }> {
    const runManager = getChapterSummaryRunManager();
    const activeRun = runManager.getByClosingEvent(args.closingEventId);
    if (activeRun && !args.force) {
      return { runId: activeRun.runId };
    }

    const descriptors = await this.loadChapterDescriptors(args.scenarioId, null);
    const descriptor = descriptors.find((d) => d.eventId === args.closingEventId);
    if (!descriptor || !descriptor.turnId) {
      throw new ServiceError("NotFound", {
        message: `Chapter break ${args.closingEventId} not found on active timeline`,
      });
    }

    const span = await this.buildSpan({
      scenarioId: args.scenarioId,
      descriptor,
      closingTurnId: descriptor.turnId,
    });

    const existingSummary = await this.db.query.chapterSummaries.findFirst({
      where: { closingEventId: args.closingEventId },
    });
    const fingerprint = await this.computeFingerprint(args.scenarioId, span);

    if (existingSummary && !args.force) {
      const status = this.computeStatus({
        span,
        summary: { ...existingSummary, title: descriptor.title ?? null },
        run: undefined,
        fingerprint,
      });
      if (status.state === "ready") {
        throw new ServiceError("InvalidInput", {
          message: "Chapter summary is already up to date.",
        });
      }
    }

    const previousContextSummaries = await this.loadPreviousSummariesForContext({
      scenarioId: args.scenarioId,
      descriptors,
      currentEventId: descriptor.eventId,
    });

    const [charactersCtx, scenarioMeta, lorebooks] = await Promise.all([
      loadScenarioCharacterContext(this.db, args.scenarioId),
      loadScenarioMetadata(this.db, args.scenarioId),
      loadScenarioLorebookAssignments(this.db, args.scenarioId),
    ]);

    const globals: ChapterSummGlobals = {
      scenarioName: scenarioMeta.name,
      scenario: scenarioMeta.description,
      range: {
        startChapterNumber: span.rangeStartChapterNumber,
        endChapterNumber: span.rangeEndChapterNumber,
      },
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
      chapterSummaries: previousContextSummaries,
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
    const statuses = await this.listForPath({
      scenarioId: args.scenarioId,
      leafTurnId: args.leafTurnId ?? null,
    });
    const runIds: string[] = [];
    for (const status of statuses) {
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

  private async resolveChapterTitle(
    scenarioId: string,
    closingEventId: string,
    closingTurnId: string
  ): Promise<string | null> {
    const descriptors = await this.loadChapterDescriptors(scenarioId, closingTurnId);
    const descriptor = descriptors.find((d) => d.eventId === closingEventId);
    return descriptor?.title ?? null;
  }

  private async loadChapterDescriptors(
    scenarioId: string,
    leafTurnId: string | null
  ): Promise<ChapterDescriptor[]> {
    const derivation = await this.deriver.run({
      scenarioId,
      leafTurnId,
      mode: { mode: "events" },
    });

    const chapters = derivation.final.chapters?.chapters ?? [];
    const descriptors: ChapterDescriptor[] = [];
    for (let idx = 0; idx < chapters.length; idx += 1) {
      const entry = chapters[idx];
      const opening = chapters[idx - 1] ?? null;
      descriptors.push({
        eventId: entry.eventId,
        turnId: entry.turnId,
        chapterNumber: entry.number,
        title: entry.title ?? null,
        openingEventId: opening?.eventId ?? null,
        rangeStartChapterNumber: entry.number,
        rangeEndChapterNumber: entry.number,
      });
    }
    return descriptors;
  }

  private async buildSpan(args: {
    scenarioId: string;
    descriptor: ChapterDescriptor;
    closingTurnId: string;
  }): Promise<ChapterSpan> {
    const { scenarioId, descriptor, closingTurnId } = args;
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
    const enrichedTurns = attachEventsToTurns(turnsOnPath, eventsByTurn);

    const closingTurnIndex = enrichedTurns.findIndex((turn) => turn.turnId === closingTurnId);
    if (closingTurnIndex === -1) {
      throw new ServiceError("NotFound", {
        message: `Closing turn ${closingTurnId} not found on path`,
      });
    }

    const openingTurnId = descriptor.openingEventId
      ? (derivation.events.find((ev) => ev.id === descriptor.openingEventId)?.turnId ?? null)
      : null;
    let startIndex = 0;
    if (openingTurnId) {
      const idx = enrichedTurns.findIndex((turn) => turn.turnId === openingTurnId);
      if (idx !== -1) startIndex = idx + 1;
    }

    const slice = enrichedTurns.slice(startIndex, closingTurnIndex + 1);
    const turnIds = slice.map((turn) => turn.turnId);

    return {
      closingEventId: descriptor.eventId,
      closingTurnId,
      chapterNumber: descriptor.chapterNumber,
      title: descriptor.title ?? null,
      openingEventId: descriptor.openingEventId,
      rangeStartChapterNumber: descriptor.rangeStartChapterNumber,
      rangeEndChapterNumber: descriptor.rangeEndChapterNumber,
      turnIds,
      turns: slice,
    };
  }

  private async computeFingerprint(
    scenarioId: string,
    span: ChapterSpan
  ): Promise<FingerprintMeta> {
    if (span.turnIds.length === 0) {
      return { turnCount: 0, maxTurnUpdatedAt: 0, spanFingerprint: span.closingEventId };
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
    hash.update(span.openingEventId ?? "null");
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
      maxTurnUpdatedAt: maxUpdatedAt,
      spanFingerprint: hash.digest("hex"),
    };
  }

  private computeStatus(args: {
    span: ChapterSpan;
    summary: ChapterSummaryRecord | null;
    run?: ChapterSummaryRunRecord;
    fingerprint?: FingerprintMeta;
  }): ChapterSummaryStatus {
    const { span, summary, run, fingerprint } = args;
    const currentTurnCount = fingerprint?.turnCount ?? span.turnIds.length;
    const base: Omit<ChapterSummaryStatus, "state"> = {
      closingEventId: span.closingEventId,
      closingTurnId: span.closingTurnId,
      chapterNumber: span.chapterNumber,
      title: span.title,
      range: {
        startChapterNumber: span.rangeStartChapterNumber,
        endChapterNumber: span.rangeEndChapterNumber,
      },
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
    if (summary.turnCount !== currentTurnCount) {
      staleReasons.push("turn_count_changed");
    }
    if (
      fingerprint &&
      summary.spanFingerprint !== fingerprint.spanFingerprint &&
      !staleReasons.includes("turn_count_changed")
    ) {
      staleReasons.push("fingerprint_mismatch");
    } else if (
      fingerprint &&
      summary.maxTurnUpdatedAt.getTime() !== fingerprint.maxTurnUpdatedAt &&
      !staleReasons.includes("turn_count_changed")
    ) {
      staleReasons.push("turn_updated_at_changed");
    }

    const state: ChapterSummaryStatusState = staleReasons.length ? "stale" : "ready";

    return {
      ...base,
      staleReasons: staleReasons.length ? staleReasons : undefined,
      state,
    };
  }

  private async loadPreviousSummariesForContext(args: {
    scenarioId: string;
    descriptors: ChapterDescriptor[];
    currentEventId: string;
  }): Promise<ChapterSummaryCtxEntry[]> {
    const ordered = args.descriptors
      .filter((d) => d.turnId)
      .filter((d) => d.eventId !== args.currentEventId);
    const eventIds = ordered.map((d) => d.eventId);
    if (eventIds.length === 0) return [];

    const rows = await this.db
      .select()
      .from(chapterSummaries)
      .where(inArray(chapterSummaries.closingEventId, eventIds));

    const byEventId = new Map<string, ChapterSummary>();
    for (const row of rows) byEventId.set(row.closingEventId, row);

    const entries: ChapterSummaryCtxEntry[] = [];
    for (const descriptor of ordered) {
      const record = byEventId.get(descriptor.eventId);
      if (!record) continue;
      entries.push(this.toCtxEntry({ ...record, title: descriptor.title ?? null }));
    }
    return entries;
  }

  private toCtxEntry(record: ChapterSummaryRecord): ChapterSummaryCtxEntry {
    return {
      closingEventId: record.closingEventId,
      closingTurnId: record.closingTurnId,
      chapterNumber: record.chapterNumber,
      title: record.title,
      summaryText: record.summaryText,
      summaryJson:
        typeof record.summaryJson === "string"
          ? JSON.parse(record.summaryJson)
          : (record.summaryJson as Record<string, unknown> | null),
      updatedAt: record.updatedAt,
    };
  }

  async getSummariesForPath(args: {
    scenarioId: string;
    leafTurnId?: string | null;
  }): Promise<ChapterSummaryCtxEntry[]> {
    const descriptors = await this.loadChapterDescriptors(args.scenarioId, args.leafTurnId ?? null);
    const relevant = descriptors.filter((d) => d.turnId);
    if (relevant.length === 0) return [];

    const eventIds = relevant.map((d) => d.eventId);
    const rows = await this.db
      .select()
      .from(chapterSummaries)
      .where(inArray(chapterSummaries.closingEventId, eventIds));

    const byEventId = new Map<string, ChapterSummary>();
    for (const row of rows) byEventId.set(row.closingEventId, row);

    const entries: ChapterSummaryCtxEntry[] = [];
    for (const descriptor of relevant) {
      const record = byEventId.get(descriptor.eventId);
      if (!record) continue;
      entries.push(this.toCtxEntry({ ...record, title: descriptor.title ?? null }));
    }

    entries.sort((a, b) => a.chapterNumber - b.chapterNumber);
    return entries;
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
      let structured = rawStructured ?? null;
      if (typeof structured === "string") {
        try {
          structured = JSON.parse(structured);
        } catch {
          // keep original string if parsing fails
        }
      }
      await this.db.transaction(async (tx) => {
        await tx
          .insert(chapterSummaries)
          .values({
            scenarioId: args.scenarioId,
            closingEventId: args.span.closingEventId,
            closingTurnId: args.span.closingTurnId,
            chapterNumber: args.span.chapterNumber,
            rangeStartChapterNumber: args.span.rangeStartChapterNumber,
            rangeEndChapterNumber: args.span.rangeEndChapterNumber,
            summaryText: text,
            summaryJson: structured,
            turnCount: args.fingerprint.turnCount,
            maxTurnUpdatedAt: new Date(args.fingerprint.maxTurnUpdatedAt),
            spanFingerprint: args.fingerprint.spanFingerprint,
            workflowId: args.workflowId,
          })
          .onConflictDoUpdate({
            target: chapterSummaries.closingEventId,
            set: {
              summaryText: text,
              summaryJson: structured ?? null,
              turnCount: args.fingerprint.turnCount,
              maxTurnUpdatedAt: new Date(args.fingerprint.maxTurnUpdatedAt),
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
