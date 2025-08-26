import { createId } from "@paralleldrive/cuid2";

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const promptTemplates = sqliteTable("prompt_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  task: text("task").notNull(),
  version: integer("version").notNull().default(1),
  // Database temmplates are intentionally typed as unknown. Consumer code
  // should parse and validate them using the appropriate Zod schema for the
  // version of the template.
  layout: text("layout", { mode: "json" })
    .$type<Record<string, unknown>[]>()
    .notNull(),
  slots: text("slots", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull(),
  responseFormat: text("response_format", { mode: "json" }).$type<
    string | Record<string, unknown>
  >(),
  responseTransforms: text("response_transforms", { mode: "json" }).$type<
    Record<string, unknown>[]
  >(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type NewPromptTemplate = typeof promptTemplates.$inferInsert;
