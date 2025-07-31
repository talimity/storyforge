import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { scenarios } from "./scenarios";
import { characters } from "./characters";

export const turns = sqliteTable("turns", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  scenarioId: text("scenario_id")
    .notNull()
    .references(() => scenarios.id, { onDelete: "cascade" }),
  characterId: text("character_id").references(() => characters.id, {
    onDelete: "set null",
  }),
  content: text("content").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  orderIndex: integer("order_index").notNull(),
  agentData: text("agent_data", { mode: "json" }).$type<{
    plannerOutput?: string;
    screenplayOutput?: string;
    proseOutput?: string;
  }>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Turn = typeof turns.$inferSelect;
export type NewTurn = Omit<typeof turns.$inferInsert, "scenarioId">;
