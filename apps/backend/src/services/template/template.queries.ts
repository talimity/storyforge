import type { SqliteDatabase } from "@storyforge/db";
import type { TaskKind } from "@storyforge/gentasks";
import { desc } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { fromDbPromptTemplate } from "./utils/marshalling.js";

export type TemplateSummary = Awaited<ReturnType<typeof listTemplates>>[0];

export async function listTemplates(
  db: SqliteDatabase,
  filters: { task?: TaskKind; search?: string }
) {
  const { task, search } = filters;

  const whereObj: Record<string, unknown> = {};
  if (task) whereObj.task = task;
  if (search) whereObj.name = { contains: search };

  const templates = await db.query.promptTemplates.findMany({
    columns: {
      id: true,
      name: true,
      kind: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      layout: true, // We need this to count layout nodes
    },
    where: whereObj,
    orderBy: (t) => [desc(t.updatedAt)],
  });

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    kind: template.kind as TaskKind,
    version: template.version,
    layoutNodeCount: template.layout.length,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }));
}

export type TemplateDetail = Awaited<ReturnType<typeof getTemplateById>>;

export async function getTemplateById(db: SqliteDatabase, id: string) {
  const template = await db.query.promptTemplates.findFirst({
    where: { id },
  });

  if (!template) {
    throw new ServiceError("NotFound", {
      message: `Template with id ${id} not found`,
    });
  }

  return {
    ...fromDbPromptTemplate(template),
    updatedAt: template.updatedAt,
    createdAt: template.createdAt,
  };
}
