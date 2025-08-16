import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SqliteDatabase } from "@storyforge/db";
import { CharacterService } from "../library/character/character-service";
import {
  type ParsedCharacterCard,
  parseTavernCard,
} from "../library/character/utils/parse-tavern-card";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to fixture data (moved to root data/ directory)
const dataPath = path.join(__dirname, "../../../../data");

type CharacterFixture = {
  id: string;
  name: string;
  card: ParsedCharacterCard;
  buffer: Buffer<ArrayBuffer>;
};

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
      const buffer = Buffer.copyBytesFrom(await readFile(filePath));
      const card = await parseTavernCard(buffer.buffer);

      // Extract character name from card for ID generation
      const name = card.isV2
        ? (card.cardData as any).data.name
        : (card.cardData as any).name;
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_");

      fixtures.push({ id, name, card, buffer });
    } catch (error) {
      console.warn(`Failed to load fixture from ${file}:`, error);
    }
  }

  cachedFixtures = fixtures;
  return fixtures;
}

export async function seedCharacterFixtures(
  db: SqliteDatabase
): Promise<CharacterFixture[]> {
  const fixtures = await loadCharacterFixtures();

  const service = new CharacterService(db);

  for (const fixture of fixtures) {
    await service.importCharacterFromTavernCard(fixture.buffer);
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
