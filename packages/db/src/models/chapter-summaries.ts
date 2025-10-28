import { createId } from "@storyforge/utils";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { modelProfiles } from "./model-profiles.js";
import { scenarios } from "./scenarios.js";
import { timelineEvents } from "./timeline-events.js";
import { turns } from "./turns.js";
import { workflows } from "./workflows.js";

export const chapterSummaries = sqliteTable(
  "chapter_summaries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    closingEventId: text("closing_event_id")
      .notNull()
      .references(() => timelineEvents.id, { onDelete: "cascade" }),
    closingTurnId: text("closing_turn_id")
      .notNull()
      .references(() => turns.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapter_number").notNull(),
    summaryText: text("summary_text").notNull(),
    summaryJson: text("summary_json", { mode: "json" }),
    turnCount: integer("turn_count").notNull(),
    maxTurnUpdatedAt: integer("max_turn_updated_at", { mode: "timestamp_ms" }).notNull(),
    spanFingerprint: text("span_fingerprint").notNull(),
    workflowId: text("workflow_id").references(() => workflows.id, { onDelete: "set null" }),
    modelProfileId: text("model_profile_id").references(() => modelProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("idx_chapter_summaries_closing_event").on(table.closingEventId)]
);

export type ChapterSummary = typeof chapterSummaries.$inferSelect;
export type NewChapterSummary = typeof chapterSummaries.$inferInsert;
