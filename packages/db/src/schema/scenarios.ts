import { createId } from "@paralleldrive/cuid2";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const scenarios = sqliteTable("scenarios", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  status: text("status")
    .$type<"active" | "archived">()
    .notNull()
    .default("active"), // 'active' | 'archived'
  settings: text("settings", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  metadata: text("metadata", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Scenario = typeof scenarios.$inferSelect;
export type NewScenario = typeof scenarios.$inferInsert;
