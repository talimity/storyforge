import { type SqliteTransaction, schema } from "@storyforge/db";
import { eq } from "drizzle-orm";

async function loadChapter(db: SqliteTransaction, chapterId: string) {
  return db
    .select()
    .from(schema.chapters)
    .where(eq(schema.chapters.id, chapterId))
    .limit(1)
    .get();
}

export const ChapterOps = {
  loadChapter,
};
