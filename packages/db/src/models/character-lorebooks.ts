import { createId } from "@storyforge/utils";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { characters } from "./characters.js";
import { lorebooks } from "./lorebooks.js";

export const characterLorebooks = sqliteTable(
  "character_lorebooks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    lorebookId: text("lorebook_id")
      .notNull()
      .references(() => lorebooks.id, { onDelete: "restrict" }),
  },
  (table) => ({
    uniqueCharacterLorebook: uniqueIndex("idx_character_lorebooks_unique").on(
      table.characterId,
      table.lorebookId
    ),
  })
);

export type CharacterLorebook = typeof characterLorebooks.$inferSelect;
export type NewCharacterLorebook = typeof characterLorebooks.$inferInsert;
