import type { SqliteDatabase } from "@storyforge/db";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import type { FastifyBaseLogger } from "fastify";

export type TRPCContext = {
  db: SqliteDatabase;
  logger: FastifyBaseLogger;
};

export async function createContext({ req }: CreateFastifyContextOptions): Promise<TRPCContext> {
  return { db: req.server.db, logger: req.log };
}
