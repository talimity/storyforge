import { type SqliteDatabase, schema } from "@storyforge/db";
import { eq, inArray } from "drizzle-orm";

export async function listCharacters(db: SqliteDatabase) {
  return db.select().from(schema.characters).all();
}

export async function getCharacters(db: SqliteDatabase, ids: string[]) {
  if (ids.length === 0) return [];

  return db
    .select()
    .from(schema.characters)
    .where(inArray(schema.characters.id, ids));
}

export async function getCharacterDetail(db: SqliteDatabase, id: string) {
  const data = await db
    .select()
    .from(schema.characters)
    .where(eq(schema.characters.id, id))
    .limit(1);

  const character = data[0];
  if (!character) return undefined;

  const [starters, examples] = await Promise.all([
    db
      .select()
      .from(schema.characterStarters)
      .where(eq(schema.characterStarters.characterId, id))
      .orderBy(
        schema.characterStarters.isPrimary,
        schema.characterStarters.createdAt
      ),
    db
      .select()
      .from(schema.characterExamples)
      .where(eq(schema.characterExamples.characterId, id))
      .orderBy(schema.characterExamples.createdAt),
  ]);

  return { ...character, starters, examples };
}

export async function getCharacterPortrait(db: SqliteDatabase, id: string) {
  const data = await db
    .select({
      portrait: schema.characters.portrait,
      focalPoint: schema.characters.portraitFocalPoint,
    })
    .from(schema.characters)
    .where(eq(schema.characters.id, id))
    .limit(1);

  return data[0];
}
