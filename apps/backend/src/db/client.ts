import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine database path based on environment
const dbPath =
  process.env.DATABASE_URL || path.join(__dirname, "../../data/storyforge.db");

// Ensure directory exists
import { mkdirSync } from "fs";
mkdirSync(path.dirname(dbPath), { recursive: true });

// Create SQLite connection
const sqlite = new Database(dbPath);

// Enable foreign keys
sqlite.pragma("foreign_keys = ON");

// Create drizzle instance with schema
export const db = drizzle(sqlite, { schema });

// Export schema for use in repositories
export { schema };

// Database connection utilities
export function closeDatabase() {
  sqlite.close();
}

// Enable WAL mode for better concurrent access
sqlite.pragma("journal_mode = WAL");
