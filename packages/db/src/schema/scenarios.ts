import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { turns } from "./turns";

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
  currentTurnId: text("current_turn_id").references(
    (): AnySQLiteColumn => turns.id, // `AnySQLiteColumn` is used to avoid circular type references
    { onDelete: "set null" }
  ),
  settings: text("settings", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}::json'`),
  metadata: text("metadata", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}::json'`),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Scenario = typeof scenarios.$inferSelect;
export type NewScenario = typeof scenarios.$inferInsert;
