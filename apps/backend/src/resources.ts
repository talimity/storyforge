import { getDbClient, type SqliteDatabase } from "@storyforge/db";
import fp from "fastify-plugin";
import { cleanData } from "./clean-data.js";

declare module "fastify" {
  interface FastifyInstance {
    db: SqliteDatabase;
  }
}

let client: SqliteDatabase;

async function getDatabaseClient() {
  if (process.env.NODE_ENV === "test") {
    throw new Error("getDatabaseClient must not be called from tests");
  }

  if (!client) {
    client = await getDbClient();
  }
  return client;
}

// for DI in tests
type Options = {
  db?: SqliteDatabase;
};

export const resources = fp<Options>(async function resources(fastify, opts) {
  const db = opts.db ?? (await getDatabaseClient());
  await cleanData(db);
  fastify.decorate("db", db);
});
