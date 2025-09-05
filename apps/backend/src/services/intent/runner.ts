import type { SqliteDatabase } from "@storyforge/db";
import { schema } from "@storyforge/db";
import { AsyncQueue } from "@storyforge/utils";
import { eq } from "drizzle-orm";
import type { IntentEvent } from "./events.js";
import type { IntentSaga } from "./sagas.js";

export class IntentRunner {
  private queue = new AsyncQueue<IntentEvent>();
  private aborted = new AbortController();
  // The accumulated text from the last generated turn
  private partial: string | undefined;
  private closedAt?: number;

  constructor(
    private deps: { db: SqliteDatabase; now: () => number },
    private intentId: string,
    private scenarioId: string,
    private kind: string,
    private saga: IntentSaga
  ) {}

  events() {
    return this.queue.iterate();
  }
  cancel() {
    this.aborted.abort();
  }

  isClosed() {
    return this.queue.isClosed();
  }
  getClosedAt() {
    return this.closedAt;
  }

  async run() {
    const { db, now } = this.deps;
    // Mark intent as running as early as possible

    await db
      .update(schema.intents)
      .set({ status: "running" })
      .where(eq(schema.intents.id, this.intentId));

    const startEv: IntentEvent = {
      type: "intent_started",
      intentId: this.intentId,
      scenarioId: this.scenarioId,
      kind: this.kind,
      ts: now(),
    };
    this.queue.push(startEv);

    try {
      for await (const ev of this.saga) {
        if (this.aborted.signal.aborted) throw new Error("Intent cancelled");
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
        this.aborted.signal.aborted || String(error).includes("cancelled");
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
