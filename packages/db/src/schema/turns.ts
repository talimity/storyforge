import { createId } from "@storyforge/utils";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { chapters } from "./chapters.js";
import { scenarioParticipants } from "./scenario-participants.js";
import { scenarios } from "./scenarios.js";

export const turns = sqliteTable(
  "turns",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    parentTurnId: text("parent_turn_id"),
    siblingOrder: text("sibling_order").notNull().default("m"), // lexographic order
    authorParticipantId: text("author_participant_id")
      .notNull()
      .references(() => scenarioParticipants.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_turn_parent").on(t.parentTurnId),
    index("idx_turn_scenario").on(t.scenarioId),
    uniqueIndex("idx_uniq_turn_parent_order").on(t.parentTurnId, t.siblingOrder),
    uniqueIndex("idx_one_root_per_scenario").on(t.scenarioId).where(sql`parent_turn_id IS NULL`),
  ]
);

export type Turn = typeof turns.$inferSelect;
export type NewTurn = Omit<typeof turns.$inferInsert, "scenarioId">;
