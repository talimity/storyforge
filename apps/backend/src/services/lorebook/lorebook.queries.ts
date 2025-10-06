import { type LorebookData, lorebookDataSchema } from "@storyforge/contracts";
import { type SqliteDatabase, schema } from "@storyforge/db";
import { asc, eq, sql } from "drizzle-orm";

export async function listLorebooks(db: SqliteDatabase, args: { q?: string; limit?: number }) {
  const { q, limit = 25 } = args;
  const query = db
    .select({
      id: schema.lorebooks.id,
      name: schema.lorebooks.name,
      description: schema.lorebooks.description,
      entryCount: schema.lorebooks.entryCount,
      createdAt: schema.lorebooks.createdAt,
      updatedAt: schema.lorebooks.updatedAt,
    })
    .from(schema.lorebooks)
    .$dynamic()
    .orderBy(asc(schema.lorebooks.name))
    .limit(limit);

  if (q && q.trim().length > 0) {
    const sanitized = q.trim().replaceAll("%", "\\%").replaceAll("_", "\\_");
    query.where(sql`lower(${schema.lorebooks.name}) LIKE lower(${`${sanitized}%`}) ESCAPE '\\'`);
  }

  return query;
}

export async function getLorebookDetail(db: SqliteDatabase, id: string) {
  const rows = await db
    .select({
      id: schema.lorebooks.id,
      name: schema.lorebooks.name,
      description: schema.lorebooks.description,
      data: schema.lorebooks.data,
      entryCount: schema.lorebooks.entryCount,
      createdAt: schema.lorebooks.createdAt,
      updatedAt: schema.lorebooks.updatedAt,
    })
    .from(schema.lorebooks)
    .where(eq(schema.lorebooks.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return undefined;
  }

  return {
    ...row,
    data: parseLorebookData(row.data),
  };
}

export async function getScenarioLorebooks(db: SqliteDatabase, scenarioId: string) {
  return db
    .select({
      id: schema.lorebooks.id,
      name: schema.lorebooks.name,
      entryCount: schema.lorebooks.entryCount,
      enabled: schema.scenarioLorebooks.enabled,
      orderIndex: schema.scenarioLorebooks.orderIndex,
    })
    .from(schema.scenarioLorebooks)
    .innerJoin(schema.lorebooks, eq(schema.scenarioLorebooks.lorebookId, schema.lorebooks.id))
    .where(eq(schema.scenarioLorebooks.scenarioId, scenarioId))
    .orderBy(asc(schema.scenarioLorebooks.orderIndex), asc(schema.lorebooks.name));
}

export async function getCharacterLorebooks(db: SqliteDatabase, characterId: string) {
  return db
    .select({
      id: schema.lorebooks.id,
      name: schema.lorebooks.name,
      description: schema.lorebooks.description,
      entryCount: schema.lorebooks.entryCount,
      createdAt: schema.lorebooks.createdAt,
      updatedAt: schema.lorebooks.updatedAt,
    })
    .from(schema.characterLorebooks)
    .innerJoin(schema.lorebooks, eq(schema.characterLorebooks.lorebookId, schema.lorebooks.id))
    .where(eq(schema.characterLorebooks.characterId, characterId))
    .orderBy(asc(schema.lorebooks.name));
}

function parseLorebookData(value: unknown): LorebookData {
  return lorebookDataSchema.parse(value);
}
