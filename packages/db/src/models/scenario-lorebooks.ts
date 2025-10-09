import { createId } from "@storyforge/utils";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { lorebooks } from "./lorebooks.js";
import { scenarios } from "./scenarios.js";

export const scenarioLorebooks = sqliteTable(
  "scenario_lorebooks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    lorebookId: text("lorebook_id")
      .notNull()
      .references(() => lorebooks.id, { onDelete: "restrict" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueScenarioLorebook: uniqueIndex("idx_scenario_lorebooks_unique").on(
      table.scenarioId,
      table.lorebookId
    ),
  })
);

export type ScenarioLorebook = typeof scenarioLorebooks.$inferSelect;
export type NewScenarioLorebook = typeof scenarioLorebooks.$inferInsert;
