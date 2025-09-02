import { createId } from "@storyforge/utils";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const workflows = sqliteTable(
  "workflows",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    task: text("task").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    version: integer("version").notNull().default(1),
    isBuiltIn: integer("is_builtin", { mode: "boolean" })
      .notNull()
      .default(false),
    steps: text("steps", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // allow referencing (id, task) from child
    uniqueIndex("idx_workflows_id_task").on(t.id, t.task),
  ]
);

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
