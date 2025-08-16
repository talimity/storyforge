import { createId } from "@paralleldrive/cuid2";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { turns } from "./turns";

export const turnLayers = sqliteTable(
  "turn_layers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    turnId: text("turn_id")
      .notNull()
      .references(() => turns.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_turn_layer_turn").on(t.turnId),
    index("idx_turn_layer_key").on(t.key),
    uniqueIndex("idx_one_layer_per_turn_key").on(t.turnId, t.key),
  ]
);

export type TurnLayers = typeof turnLayers.$inferSelect;
export type NewTurnLayer = typeof turnLayers.$inferInsert;
