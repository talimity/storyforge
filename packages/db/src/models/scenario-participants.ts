import { createId } from "@storyforge/utils";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { characters } from "./characters.js";
import { scenarios } from "./scenarios.js";

export const scenarioParticipants = sqliteTable(
  "scenario_participants",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    characterId: text("character_id").references(() => characters.id, {
      onDelete: "restrict",
    }), // Nullable for narrator or other non-character participants
    type: text("type")
      .$type<"character" | "narrator" | "deleted_character">()
      .notNull()
      .default("character"),
    status: text("status").$type<"active" | "inactive">().notNull().default("active"),
    // goal: text("goal"), // Character's goal in the scenario, if applicable; only shown to the agent controlling that character
    role: text("role"), // Free-form role description (e.g., "Player", "GM", etc.)
    isUserProxy: integer("is_user_proxy", { mode: "boolean" }).notNull().default(false), // Indicates if this participant replaces {{user}} macros
    orderIndex: integer("order_index").notNull().default(0), // Display order
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Only one record per scenario-character pair (when characterId is not null)
    unique("idx_scenario_character_unique").on(table.scenarioId, table.characterId),
  ]
);

export type ScenarioParticipant = typeof scenarioParticipants.$inferSelect;
export type NewScenarioParticipant = typeof scenarioParticipants.$inferInsert;
