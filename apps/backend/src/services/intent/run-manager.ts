import type { SqliteDatabase } from "@storyforge/db";
import type { IntentEvent } from "./events.js";
import { IntentRunner } from "./runner.js";
import type { IntentSaga } from "./sagas.js";

export type IntentHandle = {
  id: string;
  events: () => AsyncIterable<IntentEvent>;
  cancel: () => void;
};

export class IntentRunManager {
  private runs = new Map<string, IntentRunner>();

  constructor(private deps: { db: SqliteDatabase; now: () => number }) {}

  start(
    intentId: string,
    scenarioId: string,
    kind: string,
    saga: IntentSaga
  ): IntentHandle {
    const run = new IntentRunner(this.deps, intentId, scenarioId, kind, saga);
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
}

export let intentRunManager: IntentRunManager | undefined;
export function initRunManager(deps: {
  db: SqliteDatabase;
  now?: () => number;
}) {
  intentRunManager = new IntentRunManager({
    db: deps.db,
    now: deps.now ?? (() => Date.now()),
  });
  return intentRunManager;
}
