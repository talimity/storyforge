import { type StoryforgeSqliteDatabase, schema } from "@storyforge/db";
import { eq, inArray } from "drizzle-orm";

export async function listCharacters(db: StoryforgeSqliteDatabase) {
  return db.select().from(schema.characters).all();
}

export async function getCharacters(
  db: StoryforgeSqliteDatabase,
  ids: string[]
) {
  if (ids.length === 0) return [];

  return await db
    .select()
    .from(schema.characters)
    .where(inArray(schema.characters.id, ids));
}

export async function getCharacterDetail(
  db: StoryforgeSqliteDatabase,
  id: string
) {
  const data = await db
    .select()
    .from(schema.characters)
    .where(eq(schema.characters.id, id))
    .limit(1);

  const character = data[0];
  if (!character) return undefined;

  const [greetings, examples] = await Promise.all([
    db
      .select()
      .from(schema.characterGreetings)
      .where(eq(schema.characterGreetings.characterId, id))
      .orderBy(
        schema.characterGreetings.isPrimary,
        schema.characterGreetings.createdAt
      ),
    db
      .select()
      .from(schema.characterExamples)
      .where(eq(schema.characterExamples.characterId, id))
      .orderBy(schema.characterExamples.createdAt),
  ]);

  return { ...character, greetings, examples };
}

export async function getCharacterPortrait(
  db: StoryforgeSqliteDatabase,
  id: string
) {
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
