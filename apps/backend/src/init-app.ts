import { type SqliteDatabase, schema } from "@storyforge/db";
import { inArray } from "drizzle-orm";
import { logger } from "./logging.js";
import { initRunManager } from "./services/intent/run-manager.js";

export async function initApp(db: SqliteDatabase) {
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
}
