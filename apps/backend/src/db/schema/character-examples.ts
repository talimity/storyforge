import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { characters } from "./characters";

export const characterExamples = sqliteTable("character_examples", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  exampleTemplate: text("example_template").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type CharacterExample = typeof characterExamples.$inferSelect;
export type NewCharacterExample = typeof characterExamples.$inferInsert;