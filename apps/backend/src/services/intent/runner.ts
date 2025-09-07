import type { SqliteDatabase } from "@storyforge/db";
import { schema } from "@storyforge/db";
import { AsyncQueue } from "@storyforge/utils";
import { eq } from "drizzle-orm";
import { IntentCancelledError } from "./errors.js";
import type { IntentEvent, IntentGenerator } from "./types.js";

export class IntentRunner {
  private queue = new AsyncQueue<IntentEvent>();
  // The accumulated text from the last generated turn
  private partial: string | undefined;
  private closedAt?: number;

  constructor(
    private deps: { db: SqliteDatabase; now: () => number },
    private intentId: string,
    private scenarioId: string,
    private kind: string,
    private generator: IntentGenerator,
    private abortCtl: AbortController
  ) {}

  events() {
    return this.queue.iterate();
  }
  cancel() {
    this.abortCtl.abort();
  }

  isClosed() {
    return this.queue.isClosed();
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

    this.queue.push({
      type: "intent_started",
      intentId: this.intentId,
      scenarioId: this.scenarioId,
      kind: this.kind,
      ts: now(),
    });

    try {
      for await (const ev of this.generator) {
        if (this.abortCtl.signal.aborted) throw new IntentCancelledError();

        if (ev.type === "gen_token") {
          this.partial = (this.partial ?? "") + ev.delta;
        }
        if (ev.type === "effect_committed") this.partial = undefined;
        this.queue.push(ev);
      }

      this.queue.push({
        type: "intent_finished",
        intentId: this.intentId,
        ts: now(),
      });

      await db
        .update(schema.intents)
        .set({ status: "finished" })
        .where(eq(schema.intents.id, this.intentId));
    } catch (e) {
      const error = String("message" in e ? e.message : e);
      this.queue.push({
        type: "intent_failed",
        intentId: this.intentId,
        error,
        partialText: this.partial,
        ts: now(),
      });

      const cancelled =
        this.abortCtl.signal.aborted || e instanceof IntentCancelledError;

      await db
        .update(schema.intents)
        .set({ status: cancelled ? "cancelled" : "failed" })
        .where(eq(schema.intents.id, this.intentId));
    } finally {
      this.queue.close();
      this.closedAt = now();
    }
  }
}
