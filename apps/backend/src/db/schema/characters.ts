import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";

export const characters = sqliteTable("characters", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  legacyPersonality: text("legacy_personality"),
  legacyScenario: text("legacy_scenario"),
  creator: text("creator"),
  creatorNotes: text("creator_notes"),
  customSystemPrompt: text("custom_system_prompt"),
  customPostHistoryInstructions: text("custom_post_history_instructions"),
  tags: text("tags", { mode: "json" })
    .$type<string[]>()
    .default(sql`'[]'`),
  sfCharaVersion: text("sf_chara_version"),
  originalCardData: text("original_card_data", { mode: "json" }),
  cardImage: blob("card_image", { mode: "buffer" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
