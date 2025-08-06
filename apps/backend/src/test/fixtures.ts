import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StoryforgeSqliteDatabase } from "../db/client";
import { CharacterRepository } from "../shelf/character/character.repository";
import { CharacterImportService } from "../shelf/character/character-import.service";
import {
  type ParsedCharacterCard,
  parseTavernCard,
} from "../shelf/character/parse-tavern-card";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to fixture data
const dataPath = path.join(__dirname, "../../data");

export interface CharacterFixture {
  id: string;
  name: string;
  cardData: ParsedCharacterCard;
  imageBuffer: Buffer;
}

let cachedFixtures: CharacterFixture[] | null = null;

export async function loadCharacterFixtures(): Promise<CharacterFixture[]> {
  if (cachedFixtures) {
    return cachedFixtures;
  }

  const files = await readdir(dataPath);
  const cardFiles = files.filter(
    (file) => file.endsWith(".png") && file.startsWith("main_")
  );

  const fixtures: CharacterFixture[] = [];

  for (const file of cardFiles) {
    try {
      const filePath = path.join(dataPath, file);
      const buffer = await readFile(filePath);
      const cardData = await parseTavernCard(buffer.buffer);

      // Extract character name from card for ID generation
      const name = cardData.isV2
        ? (cardData.cardData as any).data.name
        : (cardData.cardData as any).name;
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_");

      fixtures.push({
        id,
        name,
        cardData,
        imageBuffer: buffer,
      });
    } catch (error) {
      console.warn(`Failed to load fixture from ${file}:`, error);
    }
  }

  cachedFixtures = fixtures;
  return fixtures;
}

export async function seedCharacterFixtures(
  db: StoryforgeSqliteDatabase
): Promise<CharacterFixture[]> {
  const fixtures = await loadCharacterFixtures();

  const repository = new CharacterRepository(db);
  const importService = new CharacterImportService(repository);

  for (const fixture of fixtures) {
    await importService.importCharacter(
      fixture.cardData.cardData,
      fixture.imageBuffer
    );
  }

  return fixtures;
}

// Helper to get a specific fixture by name
export async function getCharacterFixture(
  name: string
): Promise<CharacterFixture | undefined> {
  const fixtures = await loadCharacterFixtures();
  return fixtures.find((f) =>
    f.name.toLowerCase().includes(name.toLowerCase())
  );
}

// Helper to get fixture count for test assertions
export async function getFixtureCount(): Promise<number> {
  const fixtures = await loadCharacterFixtures();
  return fixtures.length;
}
