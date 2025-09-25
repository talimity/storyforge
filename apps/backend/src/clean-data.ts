import { type SqliteDatabase, schema } from "@storyforge/db";
import { and, desc, eq, inArray, isNull, lt, notExists, notInArray, sql } from "drizzle-orm";
import { logger } from "./logging.js";
import { initRunManager } from "./services/intent/run-manager.js";

const ORPHANED_INTENT_TTL = 24 * 60 * 60 * 1000;
const ORPHANED_RUN_TTL = 60 * 60 * 1000;
const RUN_RETENTION_LIMIT = 500;

export async function cleanData(db: SqliteDatabase) {
  initRunManager({ db, now: () => Date.now() });

  await markPendingAndRunningIntentsAsFailed(db);
  await removeOrphanedIntents(db);
  await removeOrphanedGenerationRuns(db);
  await pruneGenerationRunsBeyondLimit(db);
}

async function markPendingAndRunningIntentsAsFailed(db: SqliteDatabase) {
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
}

async function removeOrphanedIntents(db: SqliteDatabase) {
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

async function removeOrphanedGenerationRuns(db: SqliteDatabase) {
  const orphanedRuns = await db
    .delete(schema.generationRuns)
    .where(
      and(
        isNull(schema.generationRuns.turnId),
        lt(schema.generationRuns.startedAt, new Date(Date.now() - ORPHANED_RUN_TTL))
      )
    )
    .returning({ id: schema.generationRuns.id });

  if (orphanedRuns.length > 0) {
    logger.info("Removed %d orphaned generation runs", orphanedRuns.length);
  }
}

async function pruneGenerationRunsBeyondLimit(db: SqliteDatabase) {
  const [{ totalRuns }] = await db
    .select({ totalRuns: sql<number>`COUNT(*)` })
    .from(schema.generationRuns);

  if (totalRuns > RUN_RETENTION_LIMIT) {
    const keep = await db
      .select({ id: schema.generationRuns.id })
      .from(schema.generationRuns)
      .orderBy(desc(schema.generationRuns.startedAt))
      .limit(RUN_RETENTION_LIMIT);

    const keepIds = keep.map((r) => r.id);
    if (keepIds.length > 0) {
      const pruned = await db
        .delete(schema.generationRuns)
        .where(notInArray(schema.generationRuns.id, keepIds))
        .returning({ id: schema.generationRuns.id });

      if (pruned.length > 0) {
        logger.info("Pruned %d old generation runs", pruned.length);
      }
    }
  }
}
