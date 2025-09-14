import { type SqliteDatabase, schema } from "@storyforge/db";
import { and, eq, inArray, lt, notExists, sql } from "drizzle-orm";
import { logger } from "./logging.js";
import { initRunManager } from "./services/intent/run-manager.js";

const ORPHANED_INTENT_TTL = 24 * 60 * 60 * 1000;

export async function cleanData(db: SqliteDatabase) {
  initRunManager({ db, now: () => Date.now() });

  // Set any unresolved intents to failed on startup (single-process app;
  // generations do not survive restarts). This clears the unique partial
  // index on (scenarioId) where status IN ('pending','running').
  const rows = await db
    .update(schema.intents)
    .set({ status: "failed" })
    .where(inArray(schema.intents.status, ["pending", "running"]))
    .returning();

  if (rows.length > 0) {
    logger.info("Marked %d pending/running intents as failed", rows.length);
  }

  // Remove any intents that have no effects and are greater than 24 hours old
  const removed = await db
    .delete(schema.intents)
    .where(
      and(
        lt(schema.intents.createdAt, new Date(Date.now() - ORPHANED_INTENT_TTL)),
        notExists(
          db
            .select({ one: sql`1` })
            .from(schema.intentEffects)
            .where(eq(schema.intentEffects.intentId, schema.intents.id))
        )
      )
    )
    .returning({ id: schema.intents.id });

  if (removed.length > 0) {
    logger.info("Removed %d orphaned intents", removed.length);
  }
}
