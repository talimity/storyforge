import { type SqliteDatabase, schema } from "@storyforge/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getCharaAssetPaths } from "./utils/chara-asset-helpers";

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
    scenarioId?: string;
  }
) {
  const { name, scenarioId } = filters;

  const query = db
    .select({
      id: tCharacters.id,
      name: tCharacters.name,
      cardType: tCharacters.cardType,
      hasPortrait: sql<number>`${tCharacters.portrait} IS NOT NULL`,
    })
    .from(tCharacters)
    .$dynamic();

  if (scenarioId) {
    query.innerJoin(
      tScenarioParticipants,
      and(
        eq(tScenarioParticipants.characterId, tCharacters.id),
        eq(tScenarioParticipants.scenarioId, scenarioId),
        eq(tScenarioParticipants.status, "active")
      )
    );
  }

  if (name) {
    const q = name.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query.where(sql`lower(${tCharacters.name}) LIKE lower(${`${q}%`})`);
  }

  const results = await query.orderBy(tCharacters.name).limit(10);

  return results.map((char) => ({
    id: char.id,
    name: char.name,
    cardType: char.cardType,
    ...getCharaAssetPaths(char),
  }));
}
