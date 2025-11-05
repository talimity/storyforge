import type {
  ScenarioParticipant as ApiScenarioParticipant,
  ScenarioLorebookItem,
  ScenariosListQueryInput,
} from "@storyforge/contracts";
import { schema as dbschema, type SqliteDatabase, sqliteTimestampToDate } from "@storyforge/db";
import { isDefined } from "@storyforge/utils";
import { and, asc, desc, eq, inArray, isNotNull, like, or, type SQL, sql } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { getCharaAssetPaths } from "../character/utils/chara-asset-helpers.js";
import { chooseNextActorFair } from "../intent/actor-selection.js";

export type ScenarioOverview = Awaited<ReturnType<typeof listScenarios>>[0];

type ListScenariosParams = ScenariosListQueryInput | undefined;

export async function listScenarios(db: SqliteDatabase, filters?: ListScenariosParams) {
  const { status, starred, search, sort } = filters ?? {};

  const tScenarios = dbschema.scenarios;
  const tScenarioParticipants = dbschema.scenarioParticipants;
  const tCharacters = dbschema.characters;
  const tTurns = dbschema.turns;

  const turnMeta = db.$with("scenario_turn_meta").as(
    db
      .select({
        scenarioId: tTurns.scenarioId,
        turnCount: sql<number>`COUNT(${tTurns.id})`.as("turnCount"),
        lastTurnAt: sql<number | null>`MAX(${tTurns.createdAt})`.as("lastTurnAt"),
      })
      .from(tTurns)
      .groupBy(tTurns.scenarioId)
  );

  const participantMeta = db.$with("scenario_participant_meta").as(
    db
      .select({
        scenarioId: tScenarioParticipants.scenarioId,
        participantCount: sql<number>`COUNT(${tScenarioParticipants.id})`.as("participantCount"),
      })
      .from(tScenarioParticipants)
      .where(
        and(
          eq(tScenarioParticipants.type, "character"),
          eq(tScenarioParticipants.status, "active"),
          isNotNull(tScenarioParticipants.characterId)
        )
      )
      .groupBy(tScenarioParticipants.scenarioId)
  );

  const baseQuery = db
    .with(turnMeta, participantMeta)
    .select({
      id: tScenarios.id,
      name: tScenarios.name,
      description: tScenarios.description,
      status: tScenarios.status,
      isStarred: tScenarios.isStarred,
      settings: tScenarios.settings,
      metadata: tScenarios.metadata,
      createdAt: tScenarios.createdAt,
      updatedAt: tScenarios.updatedAt,
      turnCount: sql<number>`COALESCE(${turnMeta.turnCount}, 0)`,
      lastTurnAt: turnMeta.lastTurnAt,
      participantCount: sql<number>`COALESCE(${participantMeta.participantCount}, 0)`,
    })
    .from(tScenarios)
    .leftJoin(turnMeta, eq(turnMeta.scenarioId, tScenarios.id))
    .leftJoin(participantMeta, eq(participantMeta.scenarioId, tScenarios.id))
    .$dynamic();

  const conditions: SQL[] = [];

  if (status) {
    conditions.push(eq(tScenarios.status, status));
  }

  if (typeof starred === "boolean") {
    conditions.push(eq(tScenarios.isStarred, starred));
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const titleMatches = sql`lower(${tScenarios.name}) LIKE lower(${term})`;
    const participantMatches = sql`
      EXISTS (
        SELECT 1
        FROM ${tScenarioParticipants} sp
        JOIN ${tCharacters} c ON sp.character_id = c.id
        WHERE sp.scenario_id = ${tScenarios.id}
          AND sp.type = 'character'
          AND sp.status = 'active'
          AND c.name IS NOT NULL
          AND lower(c.name) LIKE lower(${term})
      )
    `;
    const searchCondition = or(titleMatches, participantMatches);
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  if (conditions.length > 0) {
    baseQuery.where(and(...conditions));
  }

  const sortKey = sort ?? "default";
  let orderedQuery = baseQuery;
  switch (sortKey) {
    case "createdAt":
      orderedQuery = orderedQuery.orderBy(desc(tScenarios.createdAt), asc(tScenarios.name));
      break;
    case "lastTurnAt":
      orderedQuery = orderedQuery.orderBy(
        desc(sql`COALESCE(${turnMeta.lastTurnAt}, 0)`),
        asc(tScenarios.name)
      );
      break;
    case "turnCount":
      orderedQuery = orderedQuery.orderBy(
        desc(sql`COALESCE(${turnMeta.turnCount}, 0)`),
        asc(tScenarios.name)
      );
      break;
    case "starred":
      orderedQuery = orderedQuery.orderBy(desc(tScenarios.isStarred), asc(tScenarios.name));
      break;
    case "participantCount":
      orderedQuery = orderedQuery.orderBy(
        desc(sql`COALESCE(${participantMeta.participantCount}, 0)`),
        asc(tScenarios.name)
      );
      break;
    default:
      orderedQuery = orderedQuery.orderBy(asc(tScenarios.name));
      break;
  }

  const scenarioRows = await orderedQuery.all();

  if (scenarioRows.length === 0) {
    return [];
  }

  const scenarioIds = scenarioRows.map((row) => row.id);

  const rawParticipants = await db
    .select({
      scenarioId: tScenarioParticipants.scenarioId,
      participantId: tScenarioParticipants.id,
      role: tScenarioParticipants.role,
      orderIndex: tScenarioParticipants.orderIndex,
      isUserProxy: tScenarioParticipants.isUserProxy,
      colorOverride: tScenarioParticipants.colorOverride,
      characterId: tCharacters.id,
      characterName: tCharacters.name,
      characterCreatedAt: tCharacters.createdAt,
      characterUpdatedAt: tCharacters.updatedAt,
      characterCardType: tCharacters.cardType,
      characterTags: tCharacters.tags,
      characterNotes: tCharacters.creatorNotes,
      characterDefaultColor: tCharacters.defaultColor,
      hasPortrait: sql<number>`CASE WHEN ${tCharacters.portrait} IS NULL THEN 0 ELSE 1 END`,
    })
    .from(tScenarioParticipants)
    .innerJoin(tCharacters, eq(tCharacters.id, tScenarioParticipants.characterId))
    .where(
      and(
        inArray(tScenarioParticipants.scenarioId, scenarioIds),
        eq(tScenarioParticipants.type, "character"),
        eq(tScenarioParticipants.status, "active")
      )
    )
    .orderBy(tScenarioParticipants.scenarioId, tScenarioParticipants.orderIndex)
    .all();

  const charactersByScenario = new Map<string, ApiScenarioParticipant[]>();

  for (const participant of rawParticipants) {
    const list = charactersByScenario.get(participant.scenarioId) ?? [];
    const { imagePath, avatarPath } = getCharaAssetPaths({
      id: participant.characterId,
      hasPortrait: participant.hasPortrait,
      updatedAt: participant.characterUpdatedAt,
    });

    const defaultColor = participant.characterDefaultColor.toLowerCase();
    const overrideColor = participant.colorOverride
      ? participant.colorOverride.toLowerCase()
      : null;
    const effectiveColor = overrideColor ?? defaultColor;

    const character: ApiScenarioParticipant["character"] = {
      id: participant.characterId,
      name: participant.characterName,
      createdAt: sqliteTimestampToDate(participant.characterCreatedAt),
      updatedAt: sqliteTimestampToDate(participant.characterUpdatedAt),
      cardType: participant.characterCardType,
      tags: Array.isArray(participant.characterTags) ? participant.characterTags : [],
      creatorNotes: participant.characterNotes,
      imagePath,
      avatarPath,
      defaultColor,
    };

    list.push({
      id: participant.participantId,
      role: participant.role,
      orderIndex: participant.orderIndex ?? 0,
      isUserProxy: Boolean(participant.isUserProxy),
      color: effectiveColor,
      character,
    });

    charactersByScenario.set(participant.scenarioId, list);
  }

  const lorebooksByScenario = await loadScenarioLorebookSummaries(db, scenarioIds);

  return scenarioRows.map((row) => {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      isStarred: Boolean(row.isStarred),
      settings: row.settings ?? {},
      metadata: row.metadata ?? {},
      createdAt: sqliteTimestampToDate(row.createdAt),
      updatedAt: sqliteTimestampToDate(row.updatedAt),
      turnCount: Number(row.turnCount ?? 0),
      lastTurnAt: row.lastTurnAt ? sqliteTimestampToDate(row.lastTurnAt) : null,
      participantCount: Number(
        row.participantCount ?? charactersByScenario.get(row.id)?.length ?? 0
      ),
      characters: charactersByScenario.get(row.id) ?? [],
      lorebooks: lorebooksByScenario.get(row.id) ?? [],
    };
  });
}

export type ScenarioDetail = Awaited<ReturnType<typeof getScenarioDetail>>;

export async function setScenarioStarred(
  db: SqliteDatabase,
  args: { id: string; isStarred: boolean }
) {
  const updated = await db
    .update(dbschema.scenarios)
    .set({ isStarred: args.isStarred })
    .where(eq(dbschema.scenarios.id, args.id))
    .returning({ id: dbschema.scenarios.id, isStarred: dbschema.scenarios.isStarred })
    .all();

  return updated[0] ?? null;
}

export async function getScenarioDetail(db: SqliteDatabase, scenarioId: string) {
  const scenario = await db.query.scenarios.findFirst({
    where: { id: scenarioId },
    with: {
      participants: {
        columns: {
          id: true,
          role: true,
          orderIndex: true,
          isUserProxy: true,
          colorOverride: true,
        },
        with: { character: scenarioCharaSummaryColumns },
        where: { type: "character" },
        orderBy: (p) => [p.orderIndex],
      },
    },
  });

  if (!scenario) {
    return undefined;
  }

  const [turnMeta] = await db
    .select({
      turnCount: sql<number>`COUNT(${dbschema.turns.id})`,
      lastTurnAt: sql<number | null>`MAX(${dbschema.turns.createdAt})`,
    })
    .from(dbschema.turns)
    .where(and(eq(dbschema.turns.scenarioId, scenarioId), eq(dbschema.turns.isGhost, false)))
    .all();

  const [participantMeta] = await db
    .select({
      participantCount: sql<number>`COUNT(${dbschema.scenarioParticipants.id})`,
    })
    .from(dbschema.scenarioParticipants)
    .where(
      and(
        eq(dbschema.scenarioParticipants.scenarioId, scenarioId),
        eq(dbschema.scenarioParticipants.type, "character"),
        eq(dbschema.scenarioParticipants.status, "active"),
        isNotNull(dbschema.scenarioParticipants.characterId)
      )
    )
    .all();

  const lorebooksByScenario = await loadScenarioLorebookSummaries(db, [scenarioId]);

  return {
    ...scenario,
    turnCount: Number(turnMeta?.turnCount ?? 0),
    lastTurnAt: turnMeta?.lastTurnAt ? sqliteTimestampToDate(turnMeta.lastTurnAt) : null,
    participantCount: Number(participantMeta?.participantCount ?? scenario.participants.length),
    lorebooks: lorebooksByScenario.get(scenarioId) ?? [],
  };
}

export type ScenarioEnvironment = Awaited<ReturnType<typeof getScenarioEnvironment>>;

/**
 * Fetches all necessary data to bootstrap the Scenario Player environment.
 */
export async function getScenarioEnvironment(db: SqliteDatabase, scenarioId: string) {
  const [scenario, rootTurn] = await Promise.all([
    db.query.scenarios.findFirst({
      where: { id: scenarioId },
      columns: { id: true, name: true, anchorTurnId: true },
      with: {
        participants: {
          columns: {
            id: true,
            type: true,
            status: true,
            characterId: true,
            isUserProxy: true,
            colorOverride: true,
          },
          orderBy: (p) => [p.orderIndex],
          with: {
            character: {
              columns: { id: true, name: true, updatedAt: true, defaultColor: true },
              extras: { hasPortrait: sql<number>`portrait IS NOT NULL` },
            },
          },
        },
      },
    }),
    db.query.turns.findFirst({
      columns: { id: true },
      where: { scenarioId, parentTurnId: { isNull: true } },
    }),
  ]);

  if (!scenario) {
    throw new ServiceError("NotFound", {
      message: `Scenario with id ${scenarioId} not found`,
    });
  }

  const participants = scenario.participants ?? [];
  const characters = participants.map((p) => p.character).filter(isDefined);

  const characterColors = new Map<string, string>();
  const characterResponses = characters.map((c) => {
    const defaultColor = c.defaultColor.toLowerCase();
    characterColors.set(c.id, defaultColor);
    return { id: c.id, name: c.name, defaultColor, ...getCharaAssetPaths(c) };
  });

  const participantResponses = participants.map((p) => {
    const override = p.colorOverride?.toLowerCase();
    const baseColor = p.characterId ? (characterColors.get(p.characterId) ?? null) : null;
    return {
      id: p.id,
      type: p.type,
      status: p.status,
      characterId: p.characterId,
      color: override ?? baseColor,
    };
  });
  const nextActorParticipantId = await chooseNextActorFair(db, scenarioId, {
    leafTurnId: scenario.anchorTurnId ?? undefined,
  });

  return {
    scenario: {
      id: scenario.id,
      title: scenario.name,
      rootTurnId: rootTurn?.id ?? null,
      anchorTurnId: scenario.anchorTurnId,
    },
    characters: characterResponses,
    participants: participantResponses,
    nextActor: {
      participantId: nextActorParticipantId,
    },
  };
}

async function loadScenarioLorebookSummaries(
  db: SqliteDatabase,
  scenarioIds: string[]
): Promise<Map<string, ScenarioLorebookItem[]>> {
  if (scenarioIds.length === 0) {
    return new Map();
  }

  const manualRows = await db
    .select({
      scenarioId: dbschema.scenarioLorebooks.scenarioId,
      assignmentId: dbschema.scenarioLorebooks.id,
      lorebookId: dbschema.scenarioLorebooks.lorebookId,
      enabled: dbschema.scenarioLorebooks.enabled,
      name: dbschema.lorebooks.name,
      entryCount: dbschema.lorebooks.entryCount,
    })
    .from(dbschema.scenarioLorebooks)
    .innerJoin(dbschema.lorebooks, eq(dbschema.scenarioLorebooks.lorebookId, dbschema.lorebooks.id))
    .where(inArray(dbschema.scenarioLorebooks.scenarioId, scenarioIds))
    .all();

  const participants = await db
    .select({
      scenarioId: dbschema.scenarioParticipants.scenarioId,
      characterId: dbschema.scenarioParticipants.characterId,
      status: dbschema.scenarioParticipants.status,
    })
    .from(dbschema.scenarioParticipants)
    .where(
      and(
        inArray(dbschema.scenarioParticipants.scenarioId, scenarioIds),
        eq(dbschema.scenarioParticipants.type, "character"),
        isNotNull(dbschema.scenarioParticipants.characterId)
      )
    )
    .all();

  const overrides = await db
    .select({
      scenarioId: dbschema.scenarioCharacterLorebookOverrides.scenarioId,
      characterLorebookId: dbschema.scenarioCharacterLorebookOverrides.characterLorebookId,
      enabled: dbschema.scenarioCharacterLorebookOverrides.enabled,
    })
    .from(dbschema.scenarioCharacterLorebookOverrides)
    .where(inArray(dbschema.scenarioCharacterLorebookOverrides.scenarioId, scenarioIds))
    .all();

  const overridesByScenario = new Map<string, Map<string, boolean>>();
  for (const override of overrides) {
    const scenarioMap = overridesByScenario.get(override.scenarioId) ?? new Map<string, boolean>();
    scenarioMap.set(override.characterLorebookId, Boolean(override.enabled));
    overridesByScenario.set(override.scenarioId, scenarioMap);
  }

  const characterIds = Array.from(
    new Set(participants.map((p) => p.characterId).filter(isDefined))
  );

  const characterLorebooks = characterIds.length
    ? await db
        .select({
          id: dbschema.characterLorebooks.id,
          characterId: dbschema.characterLorebooks.characterId,
          lorebookId: dbschema.characterLorebooks.lorebookId,
          name: dbschema.lorebooks.name,
          entryCount: dbschema.lorebooks.entryCount,
        })
        .from(dbschema.characterLorebooks)
        .innerJoin(
          dbschema.lorebooks,
          eq(dbschema.characterLorebooks.lorebookId, dbschema.lorebooks.id)
        )
        .where(inArray(dbschema.characterLorebooks.characterId, characterIds))
        .all()
    : [];

  const characterLorebooksByCharacter = new Map<string, typeof characterLorebooks>();
  for (const row of characterLorebooks) {
    const list = characterLorebooksByCharacter.get(row.characterId) ?? [];
    list.push(row);
    characterLorebooksByCharacter.set(row.characterId, list);
  }

  const participantsByScenario = new Map<string, typeof participants>();
  for (const participant of participants) {
    const list = participantsByScenario.get(participant.scenarioId) ?? [];
    list.push(participant);
    participantsByScenario.set(participant.scenarioId, list);
  }

  const manualByScenario = new Map<string, typeof manualRows>();
  for (const manual of manualRows) {
    const list = manualByScenario.get(manual.scenarioId) ?? [];
    list.push(manual);
    manualByScenario.set(manual.scenarioId, list);
  }

  const result = new Map<string, ScenarioLorebookItem[]>();

  for (const scenarioId of scenarioIds) {
    const items: ScenarioLorebookItem[] = [];

    const manualList = manualByScenario.get(scenarioId) ?? [];
    for (const manual of manualList) {
      items.push({
        kind: "manual",
        manualAssignmentId: manual.assignmentId,
        lorebookId: manual.lorebookId,
        name: manual.name,
        entryCount: manual.entryCount ?? 0,
        enabled: Boolean(manual.enabled),
        defaultEnabled: Boolean(manual.enabled),
      });
    }

    const participantList = participantsByScenario.get(scenarioId) ?? [];
    const overrideMap = overridesByScenario.get(scenarioId) ?? new Map<string, boolean>();

    for (const participant of participantList) {
      const characterId = participant.characterId;
      if (!characterId) continue;
      const characterLorebookList = characterLorebooksByCharacter.get(characterId) ?? [];
      const defaultEnabled = participant.status === "active";

      for (const link of characterLorebookList) {
        const overrideValue = overrideMap.get(link.id);
        const overrideEnabled = overrideValue === undefined ? null : overrideValue;
        const enabled = defaultEnabled ? (overrideEnabled ?? true) : false;

        items.push({
          kind: "character",
          lorebookId: link.lorebookId,
          name: link.name,
          entryCount: link.entryCount ?? 0,
          characterId,
          characterLorebookId: link.id,
          enabled,
          defaultEnabled,
          overrideEnabled,
        });
      }
    }

    items.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === "manual" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    result.set(scenarioId, items);
  }

  return result;
}

export type ScenarioCharacterStarters = Awaited<ReturnType<typeof getScenarioCharacterStarters>>;

/**
 * Fetches character starters for all characters in a scenario.
 */
export async function getScenarioCharacterStarters(db: SqliteDatabase, scenarioId: string) {
  const result = await db.query.scenarios.findFirst({
    where: { id: scenarioId },
    columns: { id: true },
    with: {
      participants: {
        columns: { id: true, characterId: true },
        where: { type: "character" },
        with: {
          character: {
            ...scenarioCharaSummaryColumns,
            with: {
              starters: {
                columns: {
                  id: true,
                  characterId: true,
                  message: true,
                  isPrimary: true,
                  createdAt: true,
                  updatedAt: true,
                },
                orderBy: (s, { desc }) => [desc(s.isPrimary), desc(s.createdAt)],
              },
            },
          },
        },
      },
    },
  });

  if (!result) {
    throw new ServiceError("NotFound", {
      message: `Scenario with id ${scenarioId} not found`,
    });
  }

  return result.participants
    .map((p) => p.character)
    .filter(isDefined)
    .map((character) => ({
      character: {
        id: character.id,
        name: character.name,
        cardType: character.cardType,
        creatorNotes: character.creatorNotes,
        tags: character.tags || [],
        ...getCharaAssetPaths(character),
        createdAt: character.createdAt,
        updatedAt: character.updatedAt,
        defaultColor: character.defaultColor.toLowerCase(),
      },
      starters: character.starters,
    }));
}

const scenarioCharaSummaryColumns = {
  columns: {
    id: true,
    name: true,
    createdAt: true,
    updatedAt: true,
    cardType: true,
    tags: true,
    creatorNotes: true,
    defaultColor: true,
  },
  extras: { hasPortrait: sql<number>`portrait IS NOT NULL` },
} as const;

export async function searchScenarios(
  db: SqliteDatabase,
  args: { q?: string; status?: "active" | "archived"; limit?: number }
) {
  const { q, status, limit = 25 } = args;
  const where = and(
    q?.length ? like(dbschema.scenarios.name, `%${q}%`) : undefined,
    status ? eq(dbschema.scenarios.status, status) : undefined
  );
  const rows = await db
    .select({
      id: dbschema.scenarios.id,
      name: dbschema.scenarios.name,
      status: dbschema.scenarios.status,
      updatedAt: dbschema.scenarios.updatedAt,
    })
    .from(dbschema.scenarios)
    .where(where)
    .orderBy(desc(dbschema.scenarios.updatedAt))
    .limit(limit);
  return rows;
}
