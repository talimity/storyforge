import { createId } from "@storyforge/utils";
import { sql } from "drizzle-orm";
import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const characters = sqliteTable("characters", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  cardType: text("card_type")
    .$type<"character" | "narrator" | "group" | "persona">()
    .notNull()
    .default("character"),
  legacyPersonality: text("legacy_personality"),
  legacyScenario: text("legacy_scenario"),
  creator: text("creator"),
  creatorNotes: text("creator_notes"),
  customSystemPrompt: text("custom_system_prompt"),
  styleInstructions: text("style_instructions"),
  tags: text("tags", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  revision: text("revision"),
  isStarred: integer("is_starred", { mode: "boolean" }).notNull().default(false),
  tavernCardData: text("tavern_card_data", { mode: "json" }),
  portrait: blob("portrait", { mode: "buffer" }),
  defaultColor: text("default_color").notNull().default("#6b7280"),
  portraitFocalPoint: text("portrait_focal_point", { mode: "json" })
    .$type<{
      x: number;
      y: number;
      w: number;
      h: number;
      c: number; // confidence
    }>()
    .notNull()
    .default(sql`'{"x":0.5,"y":0.3,"w":0.5,"h":0.5,"c":0}'`), // default for portrait images
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
