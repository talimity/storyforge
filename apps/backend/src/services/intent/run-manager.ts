import type { SqliteDatabase } from "@storyforge/db";
import { IntentRunner } from "./runner.js";
import type { IntentGenerator, IntentHandle } from "./types.js";

export class IntentRunManager {
  private runs = new Map<string, IntentRunner>();
  private reaperHandle?: ReturnType<typeof setInterval>;
  private ttlMs: number;
  private intervalMs: number;

  constructor(
    private deps: { db: SqliteDatabase; now: () => number },
    opts?: { ttlMs?: number; intervalMs?: number }
  ) {
    this.ttlMs = opts?.ttlMs ?? 3 * 60_000; // 3 minutes
    this.intervalMs = opts?.intervalMs ?? 60_000; // 1 minute
    this.reaperHandle = setInterval(() => this.sweep(), this.intervalMs);
    // Touch the handle to satisfy TS unused-property checks
    void this.reaperHandle;
  }

  start(
    intentId: string,
    scenarioId: string,
    kind: string,
    gen: IntentGenerator,
    abortCtl: AbortController
  ): IntentHandle {
    const run = new IntentRunner(
      this.deps,
      intentId,
      scenarioId,
      kind,
      gen,
      abortCtl
    );
    this.runs.set(intentId, run);
    // noinspection JSIgnoredPromiseFromCall
    run.run();
    return {
      id: intentId,
      events: () => run.events(),
      cancel: () => run.cancel(),
    };
  }

  get(intentId: string) {
    return this.runs.get(intentId);
  }

  private sweep() {
    const now = this.deps.now();
    for (const [id, run] of this.runs.entries()) {
      const closedAt = run.getClosedAt?.();
      if (closedAt && now - closedAt > this.ttlMs) {
        this.runs.delete(id);
      }
    }
  }
}

export let intentRunManager: IntentRunManager | undefined;
export function initRunManager(deps: {
  db: SqliteDatabase;
  now?: () => number;
  reaper?: { ttlMs?: number; intervalMs?: number };
}) {
  intentRunManager = new IntentRunManager(
    { db: deps.db, now: deps.now ?? (() => Date.now()) },
    deps.reaper
  );
  return intentRunManager;
}
