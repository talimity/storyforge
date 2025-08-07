import path from "node:path";
import { fileURLToPath } from "node:url";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Fastify from "fastify";
import { testAppContextPlugin } from "../app-context-plugin";
import type { StoryforgeSqliteDatabase } from "../db/client";
import * as schema from "../db/schema";
import { createTestAppContext } from "../trpc/app-context";
import { appRouter } from "../trpc/app-router";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type TestDatabase = StoryforgeSqliteDatabase;

export function createTestDatabase(): TestDatabase {
  // Create a fresh in-memory database for each test run
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  migrate(db, { migrationsFolder: path.join(__dirname, "../db/migrations") });

  return db;
}

/**
 * Create a fresh tRPC caller with a new test AppContext and database.
 */
export function createFreshTestCaller(db?: TestDatabase) {
  const testDb = db || createTestDatabase();
  const testContext = createTestAppContext(testDb);
  return {
    caller: appRouter.createCaller(testContext),
    db: testContext.db,
  };
}

/**
 * Create a fresh Fastify server instance for testing with basic plugins and a
 * test AppContext.
 */
export async function createTestFastifyServer(db?: TestDatabase) {
  const testDb = db || createTestDatabase();
  const fastify = Fastify({ logger: false });

  await fastify.register(sensible);
  await fastify.register(multipart);
  await fastify.register(testAppContextPlugin, { db: testDb });

  return fastify;
}

// Prevent accidentally blowing away real database
if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
  throw new Error("Test setup should only be used in test environment!");
}
