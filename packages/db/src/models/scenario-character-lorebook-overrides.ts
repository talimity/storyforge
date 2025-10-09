import { createId } from "@storyforge/utils";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { characterLorebooks } from "./character-lorebooks.js";
import { scenarios } from "./scenarios.js";

export const scenarioCharacterLorebookOverrides = sqliteTable(
  "scenario_character_lorebook_overrides",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    characterLorebookId: text("character_lorebook_id")
      .notNull()
      .references(() => characterLorebooks.id, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    priority: integer("priority"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueScenarioCharacterOverride: uniqueIndex(
      "idx_scenario_character_lorebook_overrides_unique"
    ).on(table.scenarioId, table.characterLorebookId),
  })
);

export type ScenarioCharacterLorebookOverride =
  typeof scenarioCharacterLorebookOverrides.$inferSelect;
export type NewScenarioCharacterLorebookOverride =
  typeof scenarioCharacterLorebookOverrides.$inferInsert;
