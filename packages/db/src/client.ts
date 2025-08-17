import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { createDatabaseConfig } from "./config";
import { relations } from "./relations";
import * as schema from "./schema/index";

async function getDbClient() {
  const config = createDatabaseConfig();
  const dbFile = path.resolve(config.path);
  const url = `file:${dbFile}`;

  const client = createClient({ url, concurrency: 1 });

  const db = drizzle(client, { schema, relations });

  await client.execute(`PRAGMA journal_mode = WAL;`);
  await client.execute(`PRAGMA foreign_keys = ON;`);
  await client.execute(`PRAGMA busy_timeout = 5000;`);
  return db;
}

export { getDbClient, schema, relations };
export type AllTables = (typeof schema)[keyof typeof schema];
export type SqliteDatabase = Awaited<ReturnType<typeof getDbClient>>;
export type SqliteTransaction = Parameters<
  Parameters<SqliteDatabase["transaction"]>[0]
>[0];
export type SqliteTxLike = SqliteDatabase | SqliteTransaction;
