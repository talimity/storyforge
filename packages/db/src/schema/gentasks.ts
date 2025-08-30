import { createId } from "@paralleldrive/cuid2";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const genTasks = sqliteTable("gentasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  version: integer("version").notNull().default(1),
  isBuiltIn: integer("is_builtin", { mode: "boolean" })
    .notNull()
    .default(false),
  steps: text("steps", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type GenTask = typeof genTasks.$inferSelect;
export type NewGenTask = typeof genTasks.$inferInsert;
