import type { WorkflowRunHandle } from "@storyforge/gentasks";

export type ChapterSummaryRunRecord = {
  closingEventId: string;
  scenarioId: string;
  runId: string;
  handle: WorkflowRunHandle;
  startedAt: number;
  finishedAt?: number;
  error?: string;
};

export class ChapterSummaryRunManager {
  private readonly byClosingEvent = new Map<string, ChapterSummaryRunRecord>();
  private readonly byRunId = new Map<string, ChapterSummaryRunRecord>();
  private sweepHandle?: ReturnType<typeof setInterval>;

  constructor(
    private readonly opts: { ttlMs: number; sweepMs: number } = {
      ttlMs: 3 * 60_000,
      sweepMs: 60_000,
    }
  ) {
    this.sweepHandle = setInterval(() => this.sweep(), this.opts.sweepMs);
    void this.sweepHandle;
  }

  track(
    closingEventId: string,
    scenarioId: string,
    handle: WorkflowRunHandle
  ): ChapterSummaryRunRecord {
    const record: ChapterSummaryRunRecord = {
      closingEventId,
      scenarioId,
      runId: handle.id,
      handle,
      startedAt: Date.now(),
    };

    this.byClosingEvent.set(closingEventId, record);
    this.byRunId.set(handle.id, record);

    void handle.result
      .then(() => this.markFinished(record))
      .catch((error: unknown) => this.markFinished(record, error));

    return record;
  }

  getByClosingEvent(closingEventId: string): ChapterSummaryRunRecord | undefined {
    return this.byClosingEvent.get(closingEventId);
  }

  getByRunId(runId: string): ChapterSummaryRunRecord | undefined {
    return this.byRunId.get(runId);
  }

  private markFinished(record: ChapterSummaryRunRecord, error?: unknown) {
    record.finishedAt = Date.now();
    record.error = error instanceof Error ? error.message : error ? String(error) : undefined;
  }

  private sweep() {
    const now = Date.now();
    for (const record of this.byRunId.values()) {
      if (record.finishedAt && now - record.finishedAt > this.opts.ttlMs) {
        this.byRunId.delete(record.runId);
        this.byClosingEvent.delete(record.closingEventId);
      }
    }
  }
}

export let chapterSummaryRunManager: ChapterSummaryRunManager | undefined;

export function getChapterSummaryRunManager(): ChapterSummaryRunManager {
  if (!chapterSummaryRunManager) {
    chapterSummaryRunManager = new ChapterSummaryRunManager();
  }
  return chapterSummaryRunManager;
}
