import type { IntentEvent } from "@storyforge/contracts";
import type { SqliteDatabase } from "@storyforge/db";
import { schema } from "@storyforge/db";
import { AsyncBroadcast } from "@storyforge/utils";
import { eq } from "drizzle-orm";
import type { IntentGenerator } from "./types.js";

export class IntentRunner {
  private eventLog: IntentEvent[] = [];
  private ticks = new AsyncBroadcast();
  private closedAt?: number;
  private partial?: string;

  constructor(
    private deps: { db: SqliteDatabase; now: () => number },
    private intentId: string,
    private scenarioId: string,
    private kind: string,
    private generator: IntentGenerator,
    private abortCtrl: AbortController
  ) {}

  events(): AsyncIterable<IntentEvent> {
    const self = this;
    return (async function* () {
      let idx = 0;

      const drain = function* () {
        while (idx < self.eventLog.length) yield self.eventLog[idx++];
      };

      // replay
      yield* drain();

      // live
      for await (const _ of self.ticks.iterate()) {
        yield* drain();
      }
    })();
  }

  cancel() {
    this.abortCtrl.abort();
  }

  isClosed() {
    return this.ticks.isClosed();
  }

  getClosedAt() {
    return this.closedAt;
  }

  async run() {
    const { db, now } = this.deps;

    await db
      .update(schema.intents)
      .set({ status: "running" })
      .where(eq(schema.intents.id, this.intentId));

    this.emit({
      type: "intent_started",
      intentId: this.intentId,
      scenarioId: this.scenarioId,
      kind: this.kind,
      ts: now(),
    });

    try {
      for await (const ev of this.generator) {
        this.abortCtrl.signal.throwIfAborted();

        if (ev.type === "gen_token") this.partial = (this.partial ?? "") + ev.delta;
        if (ev.type === "effect_committed") this.partial = undefined;

        this.emit(ev);
      }

      this.emit({ type: "intent_finished", intentId: this.intentId, ts: now() });

      await db
        .update(schema.intents)
        .set({ status: "finished" })
        .where(eq(schema.intents.id, this.intentId));
    } catch (e) {
      const cancelled = this.abortCtrl.signal.aborted;
      const error = String("message" in e ? e.message : e);

      this.emit({
        type: "intent_failed",
        intentId: this.intentId,
        error,
        partialText: this.partial,
        ts: now(),
      });

      await db
        .update(schema.intents)
        .set({ status: cancelled ? "cancelled" : "failed" })
        .where(eq(schema.intents.id, this.intentId));
    } finally {
      this.ticks.close();
      this.closedAt = now();
    }
  }

  private emit(ev: IntentEvent) {
    this.eventLog.push(ev);
    if (!this.ticks.isClosed()) this.ticks.push();
  }
}
