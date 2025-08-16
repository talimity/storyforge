import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createDatabaseConfig } from "./config";
import { relations } from "./relations";
import * as schema from "./schema/index";

const config = createDatabaseConfig();
const dbPath = config.path;

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { relations });
export { schema, relations };
export type AllTables = (typeof schema)[keyof typeof schema];
export type StoryforgeSqliteDatabase = typeof db;

export function closeDatabase() {
  sqlite.close();
}
