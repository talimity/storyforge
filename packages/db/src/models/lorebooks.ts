import { createId } from "@storyforge/utils";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const lorebooks = sqliteTable(
  "lorebooks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    description: text("description"),
    data: text("data", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    fingerprint: text("fingerprint").notNull(),
    entryCount: integer("entry_count").notNull(),
    source: text("source").$type<"silly_v2" | "character_book" | "manual">().default("manual"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    fingerprintIdx: uniqueIndex("idx_lorebooks_fingerprint").on(table.fingerprint),
    nameIdx: index("idx_lorebooks_name").on(table.name),
  })
);

export type Lorebook = typeof lorebooks.$inferSelect;
export type NewLorebook = typeof lorebooks.$inferInsert;
