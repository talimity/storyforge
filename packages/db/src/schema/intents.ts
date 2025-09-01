import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { scenarioParticipants } from "./scenario-participants";
import { scenarios } from "./scenarios";

export const intents = sqliteTable(
  "intents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().$type<"direct_control" | "story_constraint">(),
    status: text("status").notNull().$type<"pending" | "finished" | "failed">(),
    targetParticipantId: text("target_participant_id").references(
      () => scenarioParticipants.id,
      { onDelete: "restrict" }
    ),
    parameters: text("parameters", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("idx_one_pending_intent_per_scenario")
      .on(t.scenarioId)
      .where(sql`status = 'pending'`),
  ]
);

export type Intent = typeof intents.$inferSelect;
export type NewIntent = typeof intents.$inferInsert;
