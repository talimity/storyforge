import { createId } from "@paralleldrive/cuid2";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { characters } from "./characters";
import { scenarios } from "./scenarios";

export const scenarioParticipants = sqliteTable(
  "scenario_participants",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    role: text("role"), // Optional character role in scenario
    orderIndex: integer("order_index").notNull().default(0), // Display/turn order
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Only one record per scenario-character pair
    uniqueScenarioCharacter: unique().on(table.scenarioId, table.characterId),
  })
);

export type ScenarioParticipant = typeof scenarioParticipants.$inferSelect;
export type NewScenarioParticipant = typeof scenarioParticipants.$inferInsert;
