import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up the database connection
// Use the DATABASE_URL environment variable or default to a local SQLite file
const dbPath =
  process.env.DATABASE_URL || path.join(__dirname, "../../data/storyforge.db");
import { mkdirSync } from "fs";
mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
export type AllTables = (typeof schema)[keyof typeof schema];
export type StoryforgeSqliteDatabase = typeof db;

export function closeDatabase() {
  sqlite.close();
}
