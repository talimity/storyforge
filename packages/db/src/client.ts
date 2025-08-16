import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { createDatabaseConfig } from "./config";
import { relations } from "./relations";
import * as schema from "./schema/index";

const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

let db: ReturnType<typeof drizzle>;
let client: ReturnType<typeof createClient>;

if (!isTest) {
  const config = createDatabaseConfig();
  const dbFile = path.resolve(config.path);
  const url = `file:${dbFile}`;

  client = createClient({
    url,
    concurrency: 1,
  });

  db = drizzle(client, { schema, relations });

  await client.execute(`PRAGMA journal_mode = WAL;`);
  await client.execute(`PRAGMA foreign_keys = ON;`);
  await client.execute(`PRAGMA busy_timeout = 5000;`);
} else {
  // biome-ignore lint/suspicious/noExplicitAny: this is a test environment
  db = new Proxy({} as any, {
    get() {
      throw new Error(
        "Database not initialized in test environment - use createTestDatabase()"
      );
    },
  });
}

export { db, schema, relations };
export type AllTables = (typeof schema)[keyof typeof schema];
export type SqliteDatabase = typeof db;
export type SqliteTransaction = Parameters<
  Parameters<SqliteDatabase["transaction"]>[0]
>[0];
export type SqliteTxLike = SqliteDatabase | SqliteTransaction;
