import { createId } from "@storyforge/utils";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { intents } from "./intents.js";
import { modelProfiles } from "./model-profiles.js";
import { promptTemplates } from "./prompt-templates.js";
import { scenarioParticipants } from "./scenario-participants.js";
import { scenarios } from "./scenarios.js";
import { turns } from "./turns.js";
import { workflows } from "./workflows.js";

export type GenerationRunStatus = "running" | "finished" | "error" | "cancelled";

export const generationRuns = sqliteTable(
  "generation_runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    intentId: text("intent_id")
      .notNull()
      .references(() => intents.id, { onDelete: "cascade" }),
    effectSequence: integer("effect_sequence"),
    turnId: text("turn_id").references(() => turns.id, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => scenarioParticipants.id, { onDelete: "cascade" }),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    branchFromTurnId: text("branch_from_turn_id").references(() => turns.id, {
      onDelete: "cascade",
    }),
    status: text("status").$type<GenerationRunStatus>().notNull(),
    error: text("error"),
    stepOrder: text("step_order", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    finalOutputs: text("final_outputs", { mode: "json" }).$type<Record<string, unknown>>(),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    statusCheck: check(
      "chk_generation_runs_status",
      sql`${t.status} IN ('running','finished','error','cancelled')`
    ),
    byTurn: uniqueIndex("idx_generation_runs_turn")
      .on(t.turnId)
      .where(sql`${t.turnId} IS NOT NULL`),
    byIntent: index("idx_generation_runs_intent").on(t.intentId),
    byScenario: index("idx_generation_runs_scenario").on(t.scenarioId),
  })
);

export type GenerationRun = typeof generationRuns.$inferSelect;
export type NewGenerationRun = typeof generationRuns.$inferInsert;

export const generationRunSteps = sqliteTable(
  "generation_run_steps",
  {
    runId: text("run_id")
      .notNull()
      .references(() => generationRuns.id, { onDelete: "cascade" }),
    stepId: text("step_id").notNull(),
    idx: integer("idx").notNull(),
    name: text("name"),
    modelProfileId: text("model_profile_id").references(() => modelProfiles.id, {
      onDelete: "cascade",
    }),
    promptTemplateId: text("prompt_template_id").references(() => promptTemplates.id, {
      onDelete: "cascade",
    }),
    modelId: text("model_id"),
    hints: text("hints", { mode: "json" }).$type<Record<string, unknown>>(),
    promptsRendered: text("prompts_rendered", { mode: "json" })
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'`),
    promptsTransformed: text("prompts_transformed", { mode: "json" }).$type<
      Record<string, unknown>[]
    >(),
    apiPayload: text("api_payload", { mode: "json" }).$type<Record<string, unknown>>(),
    response: text("response", { mode: "json" }).$type<Record<string, unknown>>(),
    capturedOutputs: text("captured_outputs", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default(sql`'{}'`),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.runId, t.stepId] }),
    byIdx: index("idx_generation_run_steps_order").on(t.runId, t.idx),
  })
);

export type GenerationRunStep = typeof generationRunSteps.$inferSelect;
export type NewGenerationRunStep = typeof generationRunSteps.$inferInsert;
