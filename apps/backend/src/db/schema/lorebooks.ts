import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const lorebooks = sqliteTable("lorebooks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const lorebookEntries = sqliteTable("lorebook_entries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  lorebookId: text("lorebook_id")
    .notNull()
    .references(() => lorebooks.id, { onDelete: "cascade" }),
  triggers: text("triggers", { mode: "json" }).notNull().$type<string[]>(),
  content: text("content").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Lorebook = typeof lorebooks.$inferSelect;
export type NewLorebook = typeof lorebooks.$inferInsert;
export type LorebookEntry = typeof lorebookEntries.$inferSelect;
export type NewLorebookEntry = typeof lorebookEntries.$inferInsert;
