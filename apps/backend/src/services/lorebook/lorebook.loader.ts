import { type SqliteTxLike, schema } from "@storyforge/db";
import {
  type LorebookAssignment,
  normalizeLorebookData,
  parseLorebookData,
} from "@storyforge/lorebooks";
import { and, asc, eq, inArray } from "drizzle-orm";

export async function loadScenarioLorebookAssignments(
  db: SqliteTxLike,
  scenarioId: string
): Promise<LorebookAssignment[]> {
  const manualRows = await db
    .select({
      assignmentId: schema.scenarioLorebooks.id,
      lorebookId: schema.scenarioLorebooks.lorebookId,
      enabled: schema.scenarioLorebooks.enabled,
      data: schema.lorebooks.data,
      name: schema.lorebooks.name,
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
    data: unknown;
    name: string;
  }> = [];

  if (characterIds.length > 0) {
    characterLorebookRows = await db
      .select({
        id: schema.characterLorebooks.id,
        characterId: schema.characterLorebooks.characterId,
        lorebookId: schema.characterLorebooks.lorebookId,
        data: schema.lorebooks.data,
        name: schema.lorebooks.name,
      })
      .from(schema.characterLorebooks)
      .innerJoin(
        // join on lorebooks to get data/names
        schema.lorebooks,
        eq(schema.characterLorebooks.lorebookId, schema.lorebooks.id)
      )
      .where(inArray(schema.characterLorebooks.characterId, characterIds))
      .orderBy(asc(schema.lorebooks.name));
  }

  const overrideRows = await db
    .select({
      characterLorebookId: schema.scenarioCharacterLorebookOverrides.characterLorebookId,
      enabled: schema.scenarioCharacterLorebookOverrides.enabled,
    })
    .from(schema.scenarioCharacterLorebookOverrides)
    .where(eq(schema.scenarioCharacterLorebookOverrides.scenarioId, scenarioId));

  const overridesByCharacterLorebookId = new Map(
    overrideRows.map((row) => [row.characterLorebookId, row.enabled])
  );

  const manualAssignments: LorebookAssignment[] = manualRows.map((row) => {
    const data = normalizeLorebookData(parseLorebookData(row.data));
    const enabled = Boolean(row.enabled);
    return {
      lorebookId: row.lorebookId,
      kind: "manual",
      enabled,
      defaultEnabled: enabled,
      characterId: null,
      characterLorebookId: null,
      data,
    } satisfies LorebookAssignment;
  });

  const characterAssignments: LorebookAssignment[] = [];

  for (const row of characterLorebookRows) {
    if (!row.characterId) {
      continue;
    }

    const status = participantStatus.get(row.characterId) ?? "inactive";
    const defaultEnabled = status === "active";
    const override = overridesByCharacterLorebookId.get(row.id);
    const enabled = defaultEnabled ? (override ?? true) : false;
    const data = normalizeLorebookData(parseLorebookData(row.data));

    characterAssignments.push({
      lorebookId: row.lorebookId,
      kind: "character",
      enabled,
      defaultEnabled,
      characterId: row.characterId,
      characterLorebookId: row.id,
      data,
    });
  }

  const combined = [...manualAssignments, ...characterAssignments];

  combined.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "manual" ? -1 : 1;
    }
    return left.lorebookId.localeCompare(right.lorebookId);
  });

  return combined;
}
