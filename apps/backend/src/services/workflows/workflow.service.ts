import {
  type NewWorkflow,
  type SqliteDatabase,
  type SqliteTransaction,
  schema,
} from "@storyforge/db";
import type { GenStep, TaskKind } from "@storyforge/gentasks";
import { genStepSchema, taskKindSchema, validateWorkflow } from "@storyforge/gentasks";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ServiceError } from "../../service-error.js";
import { withTransaction } from "../../transaction-utils.js";

type CreateWorkflowData = {
  task: TaskKind;
  name: string;
  description?: string;
  steps: GenStep[];
};

type UpdateWorkflowData = Partial<CreateWorkflowData>;

export class WorkflowService {
  constructor(private db: SqliteDatabase) {}

  async createWorkflow(data: CreateWorkflowData, outerTx?: SqliteTransaction) {
    // Validate via gentasks schema
    validateWorkflow({
      id: "temp-id",
      name: data.name,
      description: data.description,
      task: data.task,
      version: 1,
      steps: data.steps,
    });

    const operation = async (tx: SqliteTransaction) => {
      const [wf] = await tx
        .insert(schema.workflows)
        .values({
          task: data.task,
          name: data.name,
          description: data.description,
          version: 1,
          isBuiltIn: false,
          steps: data.steps,
        })
        .returning()
        .all();

      return this.toWorkflowDto(wf);
    };

    return withTransaction(this.db, outerTx, operation);
  }

  async updateWorkflow(id: string, data: UpdateWorkflowData, outerTx?: SqliteTransaction) {
    const operation = async (tx: SqliteTransaction) => {
      const existing = await this.getEditableWorkflowOrThrow(tx, id);

      const newTask = taskKindSchema.parse(data.task ?? existing.task);
      const newName = data.name ?? existing.name;
      const newDesc = data.description ?? existing.description ?? undefined;
      const newSteps = data.steps ?? z.array(genStepSchema).parse(existing.steps);

      // Validate updated workflow
      validateWorkflow({
        id: existing.id,
        name: newName,
        description: newDesc,
        task: newTask,
        version: 1,
        steps: newSteps,
      });

      const updateData: Partial<NewWorkflow> = {};
      if (data.task !== undefined) updateData.task = taskKindSchema.parse(data.task);
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.steps !== undefined) updateData.steps = data.steps;

      const [wf] = await tx
        .update(schema.workflows)
        .set(updateData)
        .where(eq(schema.workflows.id, id))
        .returning()
        .all();

      return this.toWorkflowDto(wf);
    };

    return withTransaction(this.db, outerTx, operation);
  }

  async deleteWorkflow(id: string, outerTx?: SqliteTransaction) {
    const operation = async (tx: SqliteTransaction) => {
      await this.getEditableWorkflowOrThrow(tx, id);

      await tx.delete(schema.workflows).where(eq(schema.workflows.id, id)).execute();
    };
    return withTransaction(this.db, outerTx, operation);
  }

  async duplicateWorkflow(id: string, name: string, outerTx?: SqliteTransaction) {
    const operation = async (tx: SqliteTransaction) => {
      const existing = await this.getWorkflowOrThrow(tx, id);

      const [wf] = await tx
        .insert(schema.workflows)
        .values({
          task: existing.task,
          name,
          description: existing.description,
          version: existing.version,
          isBuiltIn: false,
          steps: existing.steps,
        })
        .returning()
        .all();

      return this.toWorkflowDto(wf);
    };
    return withTransaction(this.db, outerTx, operation);
  }

  private toWorkflowDto(wf: typeof schema.workflows.$inferSelect) {
    return {
      id: wf.id,
      name: wf.name,
      description: wf.description ?? undefined,
      task: taskKindSchema.parse(wf.task),
      version: 1 as const,
      steps: z.array(genStepSchema).parse(wf.steps),
      isBuiltIn: wf.isBuiltIn,
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt,
    };
  }

  private async getWorkflowOrThrow(tx: SqliteTransaction, id: string) {
    const existing = await tx.query.workflows.findFirst({ where: { id } });
    if (!existing) {
      throw new ServiceError("NotFound", {
        message: `Workflow ${id} not found`,
      });
    }
    return existing;
  }

  private async getEditableWorkflowOrThrow(tx: SqliteTransaction, id: string) {
    const existing = await this.getWorkflowOrThrow(tx, id);
    if (existing.isBuiltIn) {
      throw new ServiceError("Forbidden", {
        message: "Cannot modify a built-in workflow",
      });
    }
    return existing;
  }
}
