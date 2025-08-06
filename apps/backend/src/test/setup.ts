import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createTestContext } from "../app-context";
import type { StoryforgeSqliteDatabase } from "../db/client";
import * as schema from "../db/schema";
import { appRouter } from "../trpc/app-router";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type TestDatabase = StoryforgeSqliteDatabase;

export function createTestDatabase(): TestDatabase {
  // Create a fresh in-memory database for each test run
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  // Run migrations
  migrate(db, { migrationsFolder: path.join(__dirname, "../db/migrations") });

  return db;
}

export function createFreshTestCaller() {
  const testDb = createTestDatabase();
  const testContext = createTestContext(testDb);
  return {
    caller: appRouter.createCaller(testContext),
    db: testContext.db,
  };
}

// Prevent accidentally blowing away real database
if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
  throw new Error("Test setup should only be used in test environment!");
}
