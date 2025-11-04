import { createHash } from "node:crypto";
import type {
  ChapterSummary,
  ChapterSummaryStatus,
  ChapterSummaryStatusInput,
  ChapterSummaryStatusState,
  SaveChapterSummaryInput,
  SummarizeChapterInput,
  SummarizeChapterOutput,
} from "@storyforge/contracts";
import type { ChapterSummary as ChapterSummaryRow, SqliteDatabase } from "@storyforge/db";
import { schema } from "@storyforge/db";
import type { WorkflowEvent, WorkflowRunHandle } from "@storyforge/gentasks";
import type { ChatCompletionResponse } from "@storyforge/inference";
import { stripNulls } from "@storyforge/utils";
import { eq, sql } from "drizzle-orm";
import { createChildLogger } from "../../logging.js";
import { ServiceError } from "../../service-error.js";
import { getWorkflowForTaskScope } from "../workflows/workflow.queries.js";
import { WorkflowRunnerManager } from "../workflows/workflow-runner-manager.js";
import { loadChapterNodes } from "./chapter-summaries.queries.js";
import { type ChapterSpan, ChapterSummaryContextBuilder } from "./context-builder.js";
import { type ChapterSummaryRunRecord, getChapterSummaryRunManager } from "./run-manager.js";
import type { ChapterEntry, ChapterNode } from "./types.js";

const { chapterSummaries, turns, turnLayers } = schema;
const log = createChildLogger("chapter-summaries");

const SUMMARY_TEXT_KEY = "summary_text";

type FingerprintMeta = {
  turnCount: number;
  maxTurnUpdatedAt: Date;
  spanFingerprint: string;
};

export class ChapterSummariesService {
  private readonly contextBuilder: ChapterSummaryContextBuilder;

  constructor(private readonly db: SqliteDatabase) {
    this.contextBuilder = new ChapterSummaryContextBuilder(db);
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
    const pair = await this.findChapterByClosingEvent(args.closingEventId, args.scenarioId);
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

    const { span, context } = await this.contextBuilder.buildContext({
      scenarioId: args.scenarioId,
      chapter: pair.chapter,
      closing: pair.closing,
    });
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

  async saveSummary(args: SaveChapterSummaryInput): Promise<ChapterSummary | null> {
    const pair = await this.findChapterByClosingEvent(args.closingEventId, args.scenarioId);
    if (!pair?.closing) {
      throw new ServiceError("NotFound", {
        message: `Chapter break ${args.closingEventId} not found on active timeline`,
      });
    }

    const span = await this.contextBuilder.buildSpan(args.scenarioId, pair.chapter, pair.closing);

    const trimmedText = args.summaryText.trim();
    if (trimmedText.length === 0) {
      await this.db
        .delete(chapterSummaries)
        .where(eq(chapterSummaries.closingEventId, span.closingEventId));

      return null;
    }

    const fingerprint = await this.computeFingerprint(args.scenarioId, span);

    await this.db.transaction(async (tx) => {
      await tx
        .insert(chapterSummaries)
        .values({
          scenarioId: args.scenarioId,
          chapterNumber: span.chapterNumber,
          closingEventId: span.closingEventId,
          closingTurnId: span.closingTurnId,
          summaryText: trimmedText,
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
            summaryText: trimmedText,
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

  private async findChapterByClosingEvent(closingEventId: string, scenarioId?: string) {
    return this.contextBuilder.findChapterByClosingEvent(closingEventId, scenarioId);
  }

  private async buildStatusForNode(
    scenarioId: string,
    node: ChapterNode
  ): Promise<ChapterSummaryStatus> {
    if (!node.closing) {
      return {
        chapterEventId: node.chapter.eventId,
        closingEventId: undefined,
        closingTurnId: undefined,
        chapterNumber: node.chapter.chapterNumber,
        title: node.chapter.title,
        state: "current",
        summaryId: undefined,
        updatedAt: undefined,
        turnCount: undefined,
        workflowId: undefined,
        modelProfileId: undefined,
        runId: undefined,
        lastError: undefined,
      };
    }

    const [span, summary, run] = await Promise.all([
      this.contextBuilder.buildSpan(scenarioId, node.chapter, node.closing),
      this.db.query.chapterSummaries.findFirst({
        where: { closingEventId: node.closing.eventId },
      }),
      Promise.resolve(getChapterSummaryRunManager().getByClosingEvent(node.closing.eventId)),
    ]);

    const fingerprint = summary ? await this.computeFingerprint(scenarioId, span) : undefined;

    return this.computeStatus({ scenarioId, node, span, summary, fingerprint, run });
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

    type RunLastEvent = {
      type: string;
      stepId?: string;
      name?: string;
      ts: Date;
      delta?: string;
    };

    let runInfo:
      | {
          startedAt: Date;
          finishedAt?: Date;
          elapsedMs: number;
          lastEvent?: RunLastEvent;
          outputPreview?: string;
        }
      | undefined;

    if (run) {
      const snapshot = run.handle.snapshot();
      const startedAt = new Date(run.startedAt);
      const finishedAt = run.finishedAt ? new Date(run.finishedAt) : undefined;
      const elapsedMs = (finishedAt?.getTime() ?? Date.now()) - run.startedAt;

      const lastEvent = snapshot.events.at(-1);
      let runLastEvent: RunLastEvent | undefined;
      if (lastEvent) {
        runLastEvent = {
          type: lastEvent.type,
          stepId: "stepId" in lastEvent ? lastEvent.stepId : undefined,
          name: "name" in lastEvent ? lastEvent.name : undefined,
          ts: new Date(lastEvent.ts),
          delta: lastEvent.type === "stream_delta" ? lastEvent.delta : undefined,
        };
      }

      let outputPreview: string | undefined;
      const lastStepEvent = [...snapshot.events]
        .reverse()
        .find((event): event is Extract<WorkflowEvent, { stepId: string }> => "stepId" in event);

      if (lastStepEvent) {
        const deltas = snapshot.events
          .filter(
            (event): event is Extract<WorkflowEvent, { type: "stream_delta"; delta: string }> =>
              event.type === "stream_delta" &&
              "stepId" in event &&
              event.stepId === lastStepEvent.stepId
          )
          .map((event) => event.delta)
          .join("");

        if (deltas.trim().length > 0) {
          outputPreview = deltas.slice(-2000);
        } else {
          const response = snapshot.stepResponses[lastStepEvent.stepId] as
            | ChatCompletionResponse
            | undefined;
          const content = response?.message?.content;
          if (typeof content === "string") {
            outputPreview = content;
          } else if (Array.isArray(content)) {
            const parts = content as Array<string | { text?: string }>;
            outputPreview = parts
              .map((part) =>
                typeof part === "string"
                  ? part
                  : typeof part === "object" && part
                    ? (part.text ?? "")
                    : ""
              )
              .join("");
          }
        }
      }

      runInfo = {
        startedAt,
        finishedAt,
        elapsedMs,
        lastEvent: runLastEvent,
        outputPreview: outputPreview?.slice(-2000),
      };
    }

    const base = stripNulls({
      chapterEventId: node.chapter.eventId,
      closingEventId: span.closingEventId,
      closingTurnId: span.closingTurnId,
      chapterNumber: span.chapterNumber,
      title: node.chapter.title,
      summaryId: summary?.id,
      updatedAt: summary?.updatedAt,
      turnCount: currentTurnCount,
      workflowId: summary?.workflowId,
      modelProfileId: summary?.modelProfileId,
      runId: run?.runId,
      lastError: run?.error,
      run: runInfo,
    });

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
    return {
      id: row.id,
      scenarioId: row.scenarioId,
      chapterEventId: chapter.eventId,
      closingEventId: closing.eventId,
      closingTurnId: closing.turnId,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title || null,
      summaryText: row.summaryText,
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
      await this.db.transaction(async (tx) => {
        await tx
          .insert(chapterSummaries)
          .values({
            scenarioId: args.scenarioId,
            chapterNumber: args.span.chapterNumber,
            closingEventId: args.span.closingEventId,
            closingTurnId: args.span.closingTurnId,
            summaryText: text,
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
      getChapterSummaryRunManager().setError(args.handle.id, error);
    }
  }
}
