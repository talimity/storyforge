import { createId } from "@paralleldrive/cuid2";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { characters } from "./characters";

export const characterGreetings = sqliteTable("character_greetings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  isPrimary: integer("is_primary", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type CharacterGreeting = typeof characterGreetings.$inferSelect;
export type NewCharacterGreeting = Omit<
  typeof characterGreetings.$inferInsert,
  "characterId"
>;
