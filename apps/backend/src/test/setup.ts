import path from "node:path";
import { fileURLToPath } from "node:url";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import type { StoryforgeSqliteDatabase } from "@storyforge/db";
import { schema } from "@storyforge/db";
import Fastify from "fastify";
import { testAppContextPlugin } from "../app-context-plugin";
import { createTestAppContext } from "../trpc/app-context";
import { appRouter } from "../trpc/app-router";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type TestDatabase = StoryforgeSqliteDatabase;

export async function createTestDatabase(): Promise<TestDatabase> {
  const { Database, drizzle, migrate } = await import("@storyforge/db");

  // Create a fresh in-memory database for each test run
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  migrate(db, {
    migrationsFolder: path.join(
      __dirname,
      "../../../../packages/db/src/migrations"
    ),
  });

  return db;
}

/**
 * Create a fresh tRPC caller with a new test AppContext and database.
 */
export async function createFreshTestCaller(db?: TestDatabase): Promise<{
  caller: ReturnType<typeof appRouter.createCaller>;
  db: StoryforgeSqliteDatabase;
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
