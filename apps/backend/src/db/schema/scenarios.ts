import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { characters } from "./characters";

export const scenarios = sqliteTable("scenarios", {
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
    .$onUpdate(() => new Date()),
});

export const scenarioCharacters = sqliteTable("scenario_characters", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  scenarioId: text("scenario_id")
    .notNull()
    .references(() => scenarios.id, { onDelete: "cascade" }),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
});

export type Scenario = typeof scenarios.$inferSelect;
export type NewScenario = typeof scenarios.$inferInsert;
export type ScenarioCharacter = typeof scenarioCharacters.$inferSelect;
export type NewScenarioCharacter = typeof scenarioCharacters.$inferInsert;
