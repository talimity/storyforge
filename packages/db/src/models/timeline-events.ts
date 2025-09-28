import { createId } from "@storyforge/utils";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { scenarios } from "./scenarios.js";
import { turns } from "./turns.js";

export const timelineEvents = sqliteTable(
  "timeline_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),

    turnId: text("turn_id").references(() => turns.id, { onDelete: "cascade" }),
    orderKey: text("order_key").notNull().default("m"), // lexo-order within the same event anchor bucket

    kind: text("kind")
      .$type<"chapter_break" | "scene_set" | "presence_change" /**| "tone_directive" **/>()
      .notNull(),

    payloadVersion: integer("payload_version").notNull().default(1),
    payload: text("payload", { mode: "json" }).notNull(),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    byTurn: uniqueIndex("idx_events_turn").on(t.turnId, t.orderKey).where(sql`turn_id IS NOT NULL`),
    initialByScenario: uniqueIndex("idx_events_initial")
      .on(t.scenarioId, t.orderKey)
      .where(sql`turn_id IS NULL`),
    byScenario: index("idx_events_scenario").on(t.scenarioId, t.kind),
  })
);

export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type NewTimelineEvent = typeof timelineEvents.$inferInsert;
