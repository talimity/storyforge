import { type SqliteDatabase, schema } from "@storyforge/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { getCharaAssetPaths } from "./utils/chara-asset-helpers.js";

const {
  characters: tCharacters,
  characterStarters: tCharacterStarters,
  characterExamples: tCharacterExamples,
  scenarioParticipants: tScenarioParticipants,
} = schema;

export async function listCharacters(db: SqliteDatabase) {
  return db.select().from(tCharacters).all();
}

export async function getCharacters(db: SqliteDatabase, ids: string[]) {
  if (ids.length === 0) return [];

  return db.select().from(tCharacters).where(inArray(tCharacters.id, ids));
}

export async function getCharacterDetail(db: SqliteDatabase, id: string) {
  const data = await db
    .select()
    .from(tCharacters)
    .where(eq(tCharacters.id, id))
    .limit(1);

  const character = data[0];
  if (!character) return undefined;

  const [starters, examples] = await Promise.all([
    db
      .select()
      .from(tCharacterStarters)
      .where(eq(tCharacterStarters.characterId, id))
      .orderBy(tCharacterStarters.isPrimary, tCharacterStarters.createdAt),
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

  // Validate scenarioId is provided when needed
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
    whereConditions.push(
      sql`lower(${tCharacters.name}) LIKE lower(${`${q}%`})`
    );
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
  }));
}
