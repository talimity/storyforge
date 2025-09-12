import type { SqliteDatabase } from "@storyforge/db";
import { promptTemplates } from "@storyforge/db";
import type { TaskKind } from "@storyforge/gentasks";
import { and, desc, eq, like } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { fromDbPromptTemplate } from "./utils/marshalling.js";

export type TemplateSummary = Awaited<ReturnType<typeof listTemplates>>[0];

export async function listTemplates(
  db: SqliteDatabase,
  filters: { task?: TaskKind; search?: string }
) {
  const { task, search } = filters;
  const where = and(
    task ? eq(promptTemplates.kind, task) : undefined,
    search?.length ? like(promptTemplates.name, `%${search}%`) : undefined
  );

  const rows = await db
    .select({
      id: promptTemplates.id,
      name: promptTemplates.name,
      kind: promptTemplates.kind,
      version: promptTemplates.version,
      createdAt: promptTemplates.createdAt,
      updatedAt: promptTemplates.updatedAt,
      layout: promptTemplates.layout,
    })
    .from(promptTemplates)
    .where(where)
    .orderBy(desc(promptTemplates.updatedAt));

  return rows.map((template) => ({
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
