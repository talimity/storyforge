import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const characters = sqliteTable("characters", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  cardType: text("card_type")
    .$type<"character" | "group" | "persona" | "scenario">()
    .notNull()
    .default("character"),
  legacyPersonality: text("legacy_personality"),
  legacyScenario: text("legacy_scenario"),
  creator: text("creator"),
  creatorNotes: text("creator_notes"),
  customSystemPrompt: text("custom_system_prompt"),
  customPostHistoryInstructions: text("custom_post_history_instructions"),
  tags: text("tags", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  revision: text("revision"),
  originalCardData: text("original_card_data", { mode: "json" }),
  cardImage: blob("card_image", { mode: "buffer" }),
  cardFocalPoint: text("card_focal_point", { mode: "json" })
    .$type<{
      x: number;
      y: number;
      w: number;
      h: number;
      c: number; // confidence
    }>()
    .notNull()
    .default(sql`'{"x":0.5,"y":0.3,"w":0.5,"h":0.5,"c":0}'`), // default for portrait images
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
