import type {
  ScenarioParticipant as ApiScenarioParticipant,
  ScenariosListQueryInput,
} from "@storyforge/contracts";
import { schema as dbschema, type SqliteDatabase, sqliteTimestampToDate } from "@storyforge/db";
import { isDefined } from "@storyforge/utils";
import { and, asc, desc, eq, inArray, isNotNull, like, or, type SQL, sql } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { getCharaAssetPaths } from "../character/utils/chara-asset-helpers.js";

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
      characterId: tCharacters.id,
      characterName: tCharacters.name,
      characterCreatedAt: tCharacters.createdAt,
      characterUpdatedAt: tCharacters.updatedAt,
      characterCardType: tCharacters.cardType,
      characterTags: tCharacters.tags,
      characterNotes: tCharacters.creatorNotes,
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
    };

    list.push({
      id: participant.participantId,
      role: participant.role,
      orderIndex: participant.orderIndex ?? 0,
      isUserProxy: Boolean(participant.isUserProxy),
      character,
    });

    charactersByScenario.set(participant.scenarioId, list);
  }

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
        columns: { id: true, role: true, orderIndex: true, isUserProxy: true },
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

  return {
    ...scenario,
    turnCount: Number(turnMeta?.turnCount ?? 0),
    lastTurnAt: turnMeta?.lastTurnAt ? sqliteTimestampToDate(turnMeta.lastTurnAt) : null,
    participantCount: Number(participantMeta?.participantCount ?? scenario.participants.length),
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
          },
          orderBy: (p) => [p.orderIndex],
          with: {
            character: {
              columns: { id: true, name: true, updatedAt: true },
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

  return {
    scenario: {
      id: scenario.id,
      title: scenario.name,
      rootTurnId: rootTurn?.id ?? null,
      anchorTurnId: scenario.anchorTurnId,
    },
    participants: scenario.participants.map((p) => ({
      id: p.id,
      type: p.type,
      status: p.status,
      characterId: p.characterId,
    })),
    characters: scenario.participants
      .map((p) => p.character)
      .filter(isDefined)
      .map((c) => ({ id: c.id, name: c.name, ...getCharaAssetPaths(c) })),
  };
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
