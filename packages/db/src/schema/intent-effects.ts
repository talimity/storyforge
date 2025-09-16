import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { intents } from "./intents.js";
import { turns } from "./turns.js";

export const intentEffects = sqliteTable(
  "intent_effects",
  {
    intentId: text("intent_id")
      .notNull()
      .references(() => intents.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    kind: text("kind").notNull().$type<"new_turn" /* | "new_timeline_event" */>(),
    turnId: text("turn_id")
      .notNull()
      .references(() => turns.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.intentId, t.sequence] }),
    index("idx_intent_effect_turn").on(t.turnId),
  ]
);

export type IntentEffect = typeof intentEffects.$inferSelect;
export type NewIntentEffect = typeof intentEffects.$inferInsert;
