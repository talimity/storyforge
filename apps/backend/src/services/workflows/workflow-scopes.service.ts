import type { SqliteDatabase, SqliteTransaction } from "@storyforge/db";
import { schema } from "@storyforge/db";
import { and, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm/sql";
import { ServiceError } from "../../service-error.js";

type ScopeKind = "default" | "scenario" | "character" | "participant";

export class WorkflowScopesService {
  constructor(private db: SqliteDatabase) {}

  async upsertAssignment(
    data: {
      workflowId: string;
      task?: string;
      scopeKind: ScopeKind;
      scenarioId?: string;
      characterId?: string;
      participantId?: string;
    },
    outerTx?: SqliteTransaction
  ) {
    const op = async (tx: SqliteTransaction) => {
      const wf = await tx.query.workflows.findFirst({
        where: { id: data.workflowId },
      });
      if (!wf) {
        throw new ServiceError("NotFound", { message: "Workflow not found" });
      }

      const workflowTask = wf.task;
      // Validate target according to scope kind
      if (data.scopeKind === "default") {
        // no target ids
      } else if (data.scopeKind === "scenario") {
        if (!data.scenarioId)
          throw new ServiceError("InvalidInput", {
            message: "scenarioId required",
          });
      } else if (data.scopeKind === "character") {
        if (!data.characterId)
          throw new ServiceError("InvalidInput", {
            message: "characterId required",
          });
      } else if (data.scopeKind === "participant") {
        if (!data.participantId)
          throw new ServiceError("InvalidInput", {
            message: "participantId required",
          });
      }

      // Check for existing assignment for this target
      const clauses: SQL<unknown>[] = [
        eq(schema.workflowScopes.workflowTask, workflowTask),
        eq(schema.workflowScopes.scopeKind, data.scopeKind),
      ];
      if (data.scopeKind === "scenario" && data.scenarioId) {
        clauses.push(eq(schema.workflowScopes.scenarioId, data.scenarioId));
      }
      if (data.scopeKind === "character" && data.characterId) {
        clauses.push(eq(schema.workflowScopes.characterId, data.characterId));
      }
      if (data.scopeKind === "participant" && data.participantId) {
        clauses.push(eq(schema.workflowScopes.participantId, data.participantId));
      }
      const existingRow = await tx
        .select()
        .from(schema.workflowScopes)
        .where(and(...clauses))
        .limit(1);
      const existing = existingRow[0];

      if (existing) {
        // Update to point to a new workflowId (and keep workflowTask consistent)
        const [rec] = await tx
          .update(schema.workflowScopes)
          .set({
            workflowId: data.workflowId,
            workflowTask,
          })
          .where(eq(schema.workflowScopes.id, existing.id))
          .returning()
          .all();
        return rec;
      } else {
        const [rec] = await tx
          .insert(schema.workflowScopes)
          .values({
            workflowId: data.workflowId,
            workflowTask,
            scopeKind: data.scopeKind,
            scenarioId: data.scenarioId || null,
            characterId: data.characterId || null,
            participantId: data.participantId || null,
          })
          .returning()
          .all();
        return rec;
      }
    };
    return outerTx ? op(outerTx) : this.db.transaction(op);
  }

  async deleteAssignment(id: string, outerTx?: SqliteTransaction) {
    const op = async (tx: SqliteTransaction) => {
      const existing = await tx.query.workflowScopes.findFirst({
        where: { id },
      });

      if (!existing) {
        throw new ServiceError("NotFound", { message: "Scope not found" });
      }

      await tx.delete(schema.workflowScopes).where(eq(schema.workflowScopes.id, id)).execute();
    };
    return outerTx ? op(outerTx) : this.db.transaction(op);
  }
}
