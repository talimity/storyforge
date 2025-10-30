import type { CharactersListQueryInput } from "@storyforge/contracts";
import { type SqliteDatabase, schema, sqliteTimestampToDate } from "@storyforge/db";
import { and, asc, desc, eq, inArray, isNotNull, type SQL, sql } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { getCharaAssetPaths } from "./utils/chara-asset-helpers.js";

const {
  characters: tCharacters,
  characterStarters: tCharacterStarters,
  characterExamples: tCharacterExamples,
  scenarioParticipants: tScenarioParticipants,
  turns: tTurns,
} = schema;

type ListCharactersParams = CharactersListQueryInput | undefined;

export async function listCharacters(db: SqliteDatabase, params?: ListCharactersParams) {
  const filters = params ?? {};
  const turnStats = db.$with("character_turn_stats").as(
    db
      .select({
        characterId: tScenarioParticipants.characterId,
        turnCount: sql<number>`SUM(CASE WHEN ${tTurns.isGhost} = 0 THEN 1 ELSE 0 END)`.as(
          "turnCount"
        ),
        lastTurnAt: sql<
          number | null
        >`MAX(CASE WHEN ${tTurns.isGhost} = 0 THEN ${tTurns.createdAt} ELSE NULL END)`.as(
          "lastTurnAt"
        ),
      })
      .from(tScenarioParticipants)
      .leftJoin(tTurns, eq(tTurns.authorParticipantId, tScenarioParticipants.id))
      .where(
        and(
          isNotNull(tScenarioParticipants.characterId),
          eq(tScenarioParticipants.type, "character"),
          eq(tScenarioParticipants.status, "active")
        )
      )
      .groupBy(tScenarioParticipants.characterId)
  );

  const baseQuery = db
    .with(turnStats)
    .select({
      id: tCharacters.id,
      name: tCharacters.name,
      cardType: tCharacters.cardType,
      tags: tCharacters.tags,
      creatorNotes: tCharacters.creatorNotes,
      createdAt: tCharacters.createdAt,
      updatedAt: tCharacters.updatedAt,
      isStarred: tCharacters.isStarred,
      turnCount: sql<number>`COALESCE(${turnStats.turnCount}, 0)`,
      lastTurnAt: turnStats.lastTurnAt,
      hasPortrait: sql<number>`CASE WHEN ${tCharacters.portrait} IS NULL THEN 0 ELSE 1 END`,
      defaultColor: tCharacters.defaultColor,
    })
    .from(tCharacters)
    .leftJoin(turnStats, eq(turnStats.characterId, tCharacters.id))
    .$dynamic();

  const conditions: SQL[] = [];

  if (filters.actorTypes && filters.actorTypes.length > 0) {
    conditions.push(inArray(tCharacters.cardType, filters.actorTypes));
  }

  if (typeof filters.starred === "boolean") {
    conditions.push(eq(tCharacters.isStarred, filters.starred));
  }

  if (filters.search && filters.search.trim().length > 0) {
    const searchTerm = `%${filters.search.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    conditions.push(sql`lower(${tCharacters.name}) LIKE lower(${searchTerm})`);
  }

  if (conditions.length > 0) {
    baseQuery.where(and(...conditions));
  }

  const sort = filters.sort ?? "default";
  const orderings: SQL[] = [];
  switch (sort) {
    case "createdAt":
      orderings.push(desc(tCharacters.createdAt));
      break;
    case "lastTurnAt":
      orderings.push(desc(sql`COALESCE(${turnStats.lastTurnAt}, 0)`));
      break;
    case "turnCount":
      orderings.push(desc(sql`COALESCE(${turnStats.turnCount}, 0)`));
      break;
    default:
      orderings.push(asc(tCharacters.cardType));
  }

  if (sort === "turnCount" || sort === "lastTurnAt") {
    orderings.push(desc(tCharacters.updatedAt));
  }

  orderings.push(asc(tCharacters.name));

  const rows = await baseQuery.orderBy(...orderings).all();

  return rows.map((row) => {
    const { imagePath, avatarPath } = getCharaAssetPaths({
      id: row.id,
      hasPortrait: row.hasPortrait,
      updatedAt: row.updatedAt,
    });

    return {
      id: row.id,
      name: row.name,
      cardType: row.cardType,
      tags: Array.isArray(row.tags) ? row.tags : [],
      creatorNotes: row.creatorNotes,
      createdAt: sqliteTimestampToDate(row.createdAt),
      updatedAt: sqliteTimestampToDate(row.updatedAt),
      isStarred: Boolean(row.isStarred),
      lastTurnAt: row.lastTurnAt ? sqliteTimestampToDate(row.lastTurnAt) : null,
      turnCount: Number(row.turnCount ?? 0),
      imagePath,
      avatarPath,
      defaultColor: row.defaultColor,
    };
  });
}

export async function setCharacterStarred(
  db: SqliteDatabase,
  args: { id: string; isStarred: boolean }
) {
  const updated = await db
    .update(tCharacters)
    .set({ isStarred: args.isStarred })
    .where(eq(tCharacters.id, args.id))
    .returning({ id: tCharacters.id, isStarred: tCharacters.isStarred })
    .all();

  return updated[0];
}

export async function getCharacters(db: SqliteDatabase, ids: string[]) {
  if (ids.length === 0) return [];

  return db.select().from(tCharacters).where(inArray(tCharacters.id, ids));
}

export async function getCharacterDetail(db: SqliteDatabase, id: string) {
  const data = await db.select().from(tCharacters).where(eq(tCharacters.id, id)).limit(1);

  const character = data[0];
  if (!character) return undefined;

  const [starters, examples] = await Promise.all([
    db
      .select()
      .from(tCharacterStarters)
      .where(eq(tCharacterStarters.characterId, id))
      .orderBy(
        desc(tCharacterStarters.isPrimary),
        tCharacterStarters.createdAt,
        tCharacterStarters.id
      ),
    db
      .select()
      .from(tCharacterExamples)
      .where(eq(tCharacterExamples.characterId, id))
      .orderBy(tCharacterExamples.createdAt),
  ]);

  return { ...character, starters, examples };
}

export async function getCharacterPortrait(db: SqliteDatabase, id: string) {
  const data = await db
    .select({
      portrait: tCharacters.portrait,
      focalPoint: tCharacters.portraitFocalPoint,
      updatedAt: tCharacters.updatedAt,
    })
    .from(tCharacters)
    .where(eq(tCharacters.id, id))
    .limit(1);

  return data[0];
}

export async function searchCharacters(
  db: SqliteDatabase,
  filters: {
    name: string;
    filterMode?: "all" | "inScenario" | "notInScenario";
    scenarioId?: string;
  }
) {
  const { name, filterMode = "all", scenarioId } = filters;

  if (filterMode !== "all" && !scenarioId) {
    throw new ServiceError("InvalidInput", {
      message: "scenarioId is required when filterMode is not 'all'",
    });
  }

  const query = db
    .select({
      id: tCharacters.id,
      name: tCharacters.name,
      cardType: tCharacters.cardType,
      hasPortrait: sql<number>`${tCharacters.portrait} IS NOT NULL`,
      updatedAt: tCharacters.updatedAt,
      defaultColor: tCharacters.defaultColor,
    })
    .from(tCharacters)
    .$dynamic();

  // Apply scenario filtering based on filterMode
  if (filterMode === "inScenario" && scenarioId) {
    // Inner join to get only characters in the scenario
    query.innerJoin(
      tScenarioParticipants,
      and(
        eq(tScenarioParticipants.characterId, tCharacters.id),
        eq(tScenarioParticipants.scenarioId, scenarioId),
        eq(tScenarioParticipants.status, "active")
      )
    );
  } else if (filterMode === "notInScenario" && scenarioId) {
    // Left join to get characters NOT in the scenario
    query.leftJoin(
      tScenarioParticipants,
      and(
        eq(tScenarioParticipants.characterId, tCharacters.id),
        eq(tScenarioParticipants.scenarioId, scenarioId),
        eq(tScenarioParticipants.status, "active")
      )
    );
  }

  // Build where conditions
  const whereConditions = [];

  // Add the notInScenario filter condition
  if (filterMode === "notInScenario" && scenarioId) {
    whereConditions.push(sql`${tScenarioParticipants.id} IS NULL`);
  }

  // Add name filter if provided
  if (name) {
    const q = name.replaceAll("%", "\\%").replaceAll("_", "\\_");
    whereConditions.push(sql`lower(${tCharacters.name}) LIKE lower(${`${q}%`})`);
  }

  // Apply combined where conditions
  if (whereConditions.length > 0) {
    query.where(and(...whereConditions));
  }

  const results = await query.orderBy(tCharacters.name).limit(10);

  return results.map((char) => ({
    id: char.id,
    name: char.name,
    cardType: char.cardType,
    ...getCharaAssetPaths(char),
    defaultColor: char.defaultColor,
  }));
}
