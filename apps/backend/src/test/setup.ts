import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import { relations, type SqliteDatabase, schema } from "@storyforge/db";
import Fastify from "fastify";
import { createTestAppContext } from "@/api/app-context";
import { appRouter } from "@/api/app-router";
import { testAppContextPlugin } from "@/app-context-plugin";

type TestDatabase = SqliteDatabase;

export async function createTestDatabase(): Promise<TestDatabase> {
  const { createClient, drizzle, runMigrations } = await import(
    "@storyforge/db"
  );

  // Create a unique temporary database file for this test run
  const tempDir = mkdtempSync(path.join(tmpdir(), "storyforge-test-"));
  const dbPath = path.join(tempDir, "test.db");

  const sqlite = createClient({
    url: `file:${dbPath}`,
    concurrency: 1,
  });

  await sqlite.execute(`PRAGMA foreign_keys = ON;`);
  await sqlite.execute(`PRAGMA busy_timeout = 500;`);
  await sqlite.execute(`PRAGMA journal_mode = WAL;`); // WAL is better for file-based

  const db = drizzle(sqlite, { schema, relations });

  await runMigrations(db);

  // Store the temp path for cleanup
  (db as any).__tempPath = tempDir;

  return db;
}

/**
 * Create a fresh tRPC caller with a new test AppContext and database.
 */
export async function createFreshTestCaller(db?: TestDatabase): Promise<{
  caller: ReturnType<typeof appRouter.createCaller>;
  db: SqliteDatabase;
}> {
  const testDb = db || (await createTestDatabase());
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
  const testDb = db || (await createTestDatabase());
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
