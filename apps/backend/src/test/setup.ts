import { existsSync, mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SqliteDatabase } from "@storyforge/db";

type TestDatabase = SqliteDatabase;

export async function createTestDatabase(): Promise<TestDatabase> {
  const { createClient, drizzle, runMigrations, schema, relations } =
    await import("@storyforge/db");

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

// libsql memory mode is broken so we have to use tmp files and very very
// carefully delete them after tests
export function cleanupTestDatabase(db: TestDatabase) {
  if ((db as any).__tempPath) {
    const tempPath = (db as any).__tempPath;
    const dbFile = path.join(tempPath, "test.db");
    const walFile = path.join(tempPath, "test.db-wal");
    const shmFile = path.join(tempPath, "test.db-shm");

    [dbFile, walFile, shmFile].forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });

    rmdirSync(tempPath);
  }
}

/**
 * Create a fresh tRPC caller with a new test AppContext and database.
 */
export async function createFreshTestCaller(db?: TestDatabase): Promise<any> {
  const { appRouter } = await import("@/api/app-router");
  const { createTestAppContext } = await import("@/api/app-context");

  const testDb = db || (await createTestDatabase());
  const testContext = await createTestAppContext(testDb);
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
  const Fastify = (await import("fastify")).default;
  const sensible = (await import("@fastify/sensible")).default;
  const multipart = (await import("@fastify/multipart")).default;
  const { testAppContextPlugin } = await import("@/app-context-plugin");

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
