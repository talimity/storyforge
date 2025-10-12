import { type SqliteDatabase, type SqliteTxLike, schema } from "@storyforge/db";
import {
  type LorebookAssignment,
  normalizeLorebookData,
  parseLorebookData,
  sortScenarioLorebooks,
} from "@storyforge/lorebooks";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

type ParticipantStatusMap = Map<string, "active" | "inactive">;
type ManualScenarioLorebookRow = {
  assignmentId: string;
  lorebookId: string;
  enabled: boolean | number;
  data: unknown;
  name: string;
  entryCount: number;
};
type CharacterScenarioLorebookRow = {
  characterLorebookId: string;
  characterId: string | null;
  lorebookId: string;
  data: unknown;
  name: string;
  entryCount: number;
};

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
  const participantStatus = await getScenarioParticipantStatus(db, scenarioId);

  const [manualRows, overrides] = await Promise.all([
    getScenarioManualLorebookRows(db, scenarioId),
    getScenarioOverrideMap(db, scenarioId),
  ]);

  const characterLorebookRows = await getScenarioCharacterLorebookRows(
    db,
    Array.from(participantStatus.keys())
  );

  const manualItems = manualRows.map((row) => ({
    kind: "manual" as const,
    manualAssignmentId: row.assignmentId,
    lorebookId: row.lorebookId,
    name: row.name,
    entryCount: row.entryCount,
    enabled: toBoolean(row.enabled),
    defaultEnabled: toBoolean(row.enabled),
    sortKey: getSortKey(row.name, row.lorebookId),
  }));

  const characterItems: Array<{
    kind: "character";
    lorebookId: string;
    name: string;
    entryCount: number;
    characterId: string;
    characterLorebookId: string;
    enabled: boolean;
    defaultEnabled: boolean;
    overrideEnabled: boolean | null;
    sortKey: string;
  }> = [];

  for (const row of characterLorebookRows) {
    const characterId = row.characterId;
    if (!characterId) {
      continue;
    }
    if (!participantStatus.has(characterId)) {
      continue;
    }

    const status = participantStatus.get(characterId) ?? "inactive";
    const overrideEnabled = toNullableBoolean(overrides.get(row.characterLorebookId));
    const { defaultEnabled, enabled } = resolveCharacterEnablement(status, overrideEnabled);

    characterItems.push({
      kind: "character",
      lorebookId: row.lorebookId,
      name: row.name,
      entryCount: row.entryCount,
      characterId,
      characterLorebookId: row.characterLorebookId,
      enabled,
      defaultEnabled,
      overrideEnabled,
      sortKey: getSortKey(row.name, row.lorebookId),
    });
  }

  return sortScenarioLorebooks([...manualItems, ...characterItems]);
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

export async function loadScenarioLorebookAssignments(
  db: SqliteTxLike,
  scenarioId: string
): Promise<LorebookAssignment[]> {
  const participantStatus = await getScenarioParticipantStatus(db, scenarioId);

  const [manualRows, overrides] = await Promise.all([
    getScenarioManualLorebookRows(db, scenarioId),
    getScenarioOverrideMap(db, scenarioId),
  ]);

  const characterLorebookRows = await getScenarioCharacterLorebookRows(
    db,
    Array.from(participantStatus.keys())
  );

  const manualAssignments = manualRows.map((row) => {
    const enabled = toBoolean(row.enabled);
    return {
      lorebookId: row.lorebookId,
      kind: "manual",
      enabled,
      defaultEnabled: enabled,
      characterId: null,
      characterLorebookId: null,
      data: normalizeLorebookData(parseLorebookData(row.data)),
    } satisfies LorebookAssignment;
  });

  const characterAssignments: LorebookAssignment[] = [];
  for (const row of characterLorebookRows) {
    const characterId = row.characterId;
    if (!characterId) {
      continue;
    }
    if (!participantStatus.has(characterId)) {
      continue;
    }

    const status = participantStatus.get(characterId) ?? "inactive";
    const overrideEnabled = toNullableBoolean(overrides.get(row.characterLorebookId));
    const { defaultEnabled, enabled } = resolveCharacterEnablement(status, overrideEnabled);

    characterAssignments.push({
      lorebookId: row.lorebookId,
      kind: "character",
      enabled,
      defaultEnabled,
      characterId,
      characterLorebookId: row.characterLorebookId,
      data: normalizeLorebookData(parseLorebookData(row.data)),
    });
  }

  return sortAssignments([...manualAssignments, ...characterAssignments]);
}

async function getScenarioParticipantStatus(
  db: SqliteTxLike,
  scenarioId: string
): Promise<ParticipantStatusMap> {
  const rows = await db
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

  const status: ParticipantStatusMap = new Map();
  for (const row of rows) {
    if (!row.characterId) {
      continue;
    }
    status.set(row.characterId, row.status);
  }

  return status;
}

async function getScenarioManualLorebookRows(
  db: SqliteTxLike,
  scenarioId: string
): Promise<ManualScenarioLorebookRow[]> {
  return db
    .select({
      assignmentId: schema.scenarioLorebooks.id,
      lorebookId: schema.scenarioLorebooks.lorebookId,
      enabled: schema.scenarioLorebooks.enabled,
      data: schema.lorebooks.data,
      name: schema.lorebooks.name,
      entryCount: schema.lorebooks.entryCount,
    })
    .from(schema.scenarioLorebooks)
    .innerJoin(schema.lorebooks, eq(schema.scenarioLorebooks.lorebookId, schema.lorebooks.id))
    .where(eq(schema.scenarioLorebooks.scenarioId, scenarioId))
    .orderBy(asc(schema.lorebooks.name));
}

async function getScenarioCharacterLorebookRows(
  db: SqliteTxLike,
  characterIds: string[]
): Promise<CharacterScenarioLorebookRow[]> {
  if (characterIds.length === 0) {
    return [];
  }

  return db
    .select({
      characterLorebookId: schema.characterLorebooks.id,
      characterId: schema.characterLorebooks.characterId,
      lorebookId: schema.characterLorebooks.lorebookId,
      data: schema.lorebooks.data,
      name: schema.lorebooks.name,
      entryCount: schema.lorebooks.entryCount,
    })
    .from(schema.characterLorebooks)
    .innerJoin(schema.lorebooks, eq(schema.characterLorebooks.lorebookId, schema.lorebooks.id))
    .where(inArray(schema.characterLorebooks.characterId, characterIds))
    .orderBy(asc(schema.lorebooks.name));
}

async function getScenarioOverrideMap(
  db: SqliteTxLike,
  scenarioId: string
): Promise<Map<string, boolean>> {
  const rows = await db
    .select({
      characterLorebookId: schema.scenarioCharacterLorebookOverrides.characterLorebookId,
      enabled: schema.scenarioCharacterLorebookOverrides.enabled,
    })
    .from(schema.scenarioCharacterLorebookOverrides)
    .where(eq(schema.scenarioCharacterLorebookOverrides.scenarioId, scenarioId));

  return new Map(rows.map((row) => [row.characterLorebookId, row.enabled]));
}

function resolveCharacterEnablement(
  status: "active" | "inactive",
  overrideEnabled: boolean | null
) {
  const defaultEnabled = status === "active";
  if (!defaultEnabled) {
    return { defaultEnabled, enabled: false };
  }

  return { defaultEnabled, enabled: overrideEnabled ?? true };
}

function toNullableBoolean(value: boolean | undefined): boolean | null {
  if (value === undefined) {
    return null;
  }
  return value;
}

function toBoolean(value: unknown): boolean {
  return Boolean(value);
}

function getSortKey(name: string | null, fallback: string) {
  return name ?? fallback;
}

function sortAssignments(assignments: LorebookAssignment[]) {
  const items = assignments.slice();
  items.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "manual" ? -1 : 1;
    }
    return left.lorebookId.localeCompare(right.lorebookId);
  });
  return items;
}
