import { createId } from "@storyforge/utils";
import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { scenarioParticipants } from "./scenario-participants.js";
import { scenarios } from "./scenarios.js";

type IntentKind =
  | "manual_control"
  | "guided_control"
  | "narrative_constraint"
  | "continue_story";
type IntentStatus = "pending" | "running" | "finished" | "failed" | "cancelled";

export const intents = sqliteTable(
  "intents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().$type<IntentKind>(),
    status: text("status").notNull().$type<IntentStatus>(),
    targetParticipantId: text("target_participant_id").references(
      () => scenarioParticipants.id,
      { onDelete: "restrict" }
    ),
    inputText: text("input_text"),
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
      .where(sql`status IN ('pending','running')`),
  ]
);

export type Intent = typeof intents.$inferSelect;
export type NewIntent = typeof intents.$inferInsert;
