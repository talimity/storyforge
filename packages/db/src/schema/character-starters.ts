import { createId } from "@storyforge/utils";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { characters } from "./characters.js";

export const characterStarters = sqliteTable("character_starters", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type CharacterStarter = typeof characterStarters.$inferSelect;
export type NewCharacterStarter = Omit<typeof characterStarters.$inferInsert, "characterId">;
