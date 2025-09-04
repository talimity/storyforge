import { createId } from "@storyforge/utils";
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { characters } from "./characters.js";
import { scenarioParticipants } from "./scenario-participants.js";
import { scenarios } from "./scenarios.js";
import { workflows } from "./workflows.js";

export type WorkflowScopeKind =
  | "default"
  | "scenario"
  | "character"
  | "participant";

export const workflowScopes = sqliteTable(
  "workflow_scopes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    workflowTask: text("workflow_task").notNull(),
    scopeKind: text("scope_kind").$type<WorkflowScopeKind>().notNull(),
    scenarioId: text("scenario_id").references(() => scenarios.id, {
      onDelete: "cascade",
    }),
    characterId: text("character_id").references(() => characters.id, {
      onDelete: "cascade",
    }),
    participantId: text("participant_id").references(
      () => scenarioParticipants.id,
      { onDelete: "cascade" }
    ),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // for a given task kind and target there can only be one scope assignment
    uniqueIndex("idx_one_character_task_target")
      .on(t.workflowTask, t.characterId)
      .where(sql`scope_kind = 'character'`),

    uniqueIndex("idx_one_scenario_task_target")
      .on(t.workflowTask, t.scenarioId)
      .where(sql`scope_kind = 'scenario'`),

    uniqueIndex("idx_one_participant_task_target")
      .on(t.workflowTask, t.participantId)
      .where(sql`scope_kind = 'participant'`),

    uniqueIndex("idx_one_default_task_target")
      .on(t.workflowTask)
      .where(sql`scope_kind = 'default'`),

    // this just ensures a scope assignment uses the same task kind as the
    // bound workflow
    foreignKey({
      name: "fk_workflow_scope_workflow",
      columns: [t.workflowId, t.workflowTask],
      foreignColumns: [workflows.id, workflows.task],
    }),

    check(
      "chk_consistent_scope_kind",
      sql`
      (scope_kind = 'default')
      OR
      (scope_kind = 'scenario' AND scenario_id IS NOT NULL)
      OR
      (scope_kind = 'character' AND character_id IS NOT NULL)
      OR
      (scope_kind = 'participant' AND participant_id IS NOT NULL)`
    ),
  ]
);
