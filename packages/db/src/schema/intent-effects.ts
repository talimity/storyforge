import { createId } from "@paralleldrive/cuid2";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { intents } from "./intents.js";
import { turns } from "./turns.js";

export const intentEffects = sqliteTable("intent_effects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  intentId: text("scenario_id")
    .notNull()
    .references(() => intents.id, { onDelete: "cascade" }),
  kind: text("kind")
    .notNull()
    .$type<"insert_turn" | "generate_turn" | "create_timeline_event">(),
  turnId: text("turn_id")
    .notNull()
    .references(() => turns.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export type IntentEffect = typeof intentEffects.$inferSelect;
export type NewIntentEffect = typeof intentEffects.$inferInsert;
