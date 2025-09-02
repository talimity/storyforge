import { type SqliteDatabase, schema } from "@storyforge/db";
import { eq } from "drizzle-orm";
import { logger } from "./logging.js";
import { initRunManager } from "./services/intent/run-manager.js";

export async function initApp(db: SqliteDatabase) {
  initRunManager({ db, now: () => Date.now() });

  // Set any pending intents to failed
  const rows = await db
    .update(schema.intents)
    .set({ status: "failed" })
    .where(eq(schema.intents.status, "pending"))
    .returning();

  if (rows.length > 0) {
    logger.info("Marked %d pending intents as failed", rows.length);
  }
}
