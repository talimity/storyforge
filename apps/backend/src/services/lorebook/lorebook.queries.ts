import { type LorebookData, lorebookDataSchema } from "@storyforge/contracts";
import { type SqliteDatabase, schema } from "@storyforge/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

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
  const manualRows = await db
    .select({
      assignmentId: schema.scenarioLorebooks.id,
      lorebookId: schema.scenarioLorebooks.lorebookId,
      enabled: schema.scenarioLorebooks.enabled,
      name: schema.lorebooks.name,
      entryCount: schema.lorebooks.entryCount,
    })
    .from(schema.scenarioLorebooks)
    .innerJoin(schema.lorebooks, eq(schema.scenarioLorebooks.lorebookId, schema.lorebooks.id))
    .where(eq(schema.scenarioLorebooks.scenarioId, scenarioId))
    .orderBy(asc(schema.lorebooks.name));

  const participantRows = await db
    .select({
      characterId: schema.scenarioParticipants.characterId,
      status: schema.scenarioParticipants.status,
    })
    .from(schema.scenarioParticipants)
    .where(
      and(
        eq(schema.scenarioParticipants.scenarioId, scenarioId),
        eq(schema.scenarioParticipants.type, "character")
      )
    );

  const participantStatus = new Map<string, "active" | "inactive">();
  for (const participant of participantRows) {
    if (!participant.characterId) {
      continue;
    }
    participantStatus.set(participant.characterId, participant.status);
  }

  const characterIds = Array.from(participantStatus.keys());

  let characterLorebookRows: Array<{
    id: string;
    characterId: string;
    lorebookId: string;
    name: string;
    entryCount: number;
  }> = [];

  if (characterIds.length > 0) {
    characterLorebookRows = await db
      .select({
        id: schema.characterLorebooks.id,
        characterId: schema.characterLorebooks.characterId,
        lorebookId: schema.characterLorebooks.lorebookId,
        name: schema.lorebooks.name,
        entryCount: schema.lorebooks.entryCount,
      })
      .from(schema.characterLorebooks)
      .innerJoin(schema.lorebooks, eq(schema.characterLorebooks.lorebookId, schema.lorebooks.id))
      .where(inArray(schema.characterLorebooks.characterId, characterIds))
      .orderBy(asc(schema.lorebooks.name));
  }

  const overrides = await db
    .select({
      characterLorebookId: schema.scenarioCharacterLorebookOverrides.characterLorebookId,
      enabled: schema.scenarioCharacterLorebookOverrides.enabled,
    })
    .from(schema.scenarioCharacterLorebookOverrides)
    .where(eq(schema.scenarioCharacterLorebookOverrides.scenarioId, scenarioId));

  const overridesById = new Map(overrides.map((row) => [row.characterLorebookId, row.enabled]));

  const manualItems = manualRows.map((row) => ({
    kind: "manual" as const,
    manualAssignmentId: row.assignmentId,
    lorebookId: row.lorebookId,
    name: row.name,
    entryCount: row.entryCount,
    enabled: Boolean(row.enabled),
    defaultEnabled: Boolean(row.enabled),
    sortKey: row.name ?? row.lorebookId,
  }));

  const characterItems = characterLorebookRows
    .filter((row) => row.characterId && participantStatus.has(row.characterId))
    .map((row) => {
      const status = participantStatus.get(row.characterId) ?? "inactive";
      const defaultEnabled = status === "active";
      const overrideEnabled = overridesById.get(row.id) ?? null;
      const effectiveEnabled = defaultEnabled ? (overrideEnabled ?? true) : false;

      return {
        kind: "character" as const,
        lorebookId: row.lorebookId,
        name: row.name,
        entryCount: row.entryCount,
        characterId: row.characterId,
        characterLorebookId: row.id,
        enabled: effectiveEnabled,
        defaultEnabled,
        overrideEnabled,
        sortKey: row.name ?? row.lorebookId,
      };
    });

  return [...manualItems, ...characterItems];
}

export async function getCharacterLorebooks(db: SqliteDatabase, characterId: string) {
  return db
    .select({
      characterLorebookId: schema.characterLorebooks.id,
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
