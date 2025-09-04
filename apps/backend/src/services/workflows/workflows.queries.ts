import type { SqliteDatabase } from "@storyforge/db";
import { schema } from "@storyforge/db";
import { genStepSchema, taskKindSchema } from "@storyforge/gentasks";
import { and, desc, eq, like } from "drizzle-orm";
import { z } from "zod";
import { ServiceError } from "../../service-error.js";

export async function listWorkflows(
  db: SqliteDatabase,
  filters: { task?: string; search?: string }
) {
  const where = and(
    filters.task ? eq(schema.workflows.task, filters.task) : undefined,
    filters.search
      ? like(schema.workflows.name, `%${filters.search}%`)
      : undefined
  );

  const items = await db
    .select()
    .from(schema.workflows)
    .where(where)
    .orderBy(desc(schema.workflows.updatedAt));

  return items.map((wf) => ({
    id: wf.id,
    name: wf.name,
    task: taskKindSchema.parse(wf.task),
    version: 1 as const,
    stepCount: z.array(genStepSchema).parse(wf.steps).length,
    isBuiltIn: wf.isBuiltIn,
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
  }));
}

export async function getWorkflowById(db: SqliteDatabase, id: string) {
  const wf = await db.query.workflows.findFirst({ where: { id } });
  if (!wf) {
    throw new ServiceError("NotFound", { message: `Workflow ${id} not found` });
  }
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
