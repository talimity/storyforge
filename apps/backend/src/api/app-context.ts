import type { SqliteDatabase } from "@storyforge/db";
import { getDbClient } from "@storyforge/db";
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";

export interface AppContext {
  req: FastifyRequest;
  res: FastifyReply;
  logger: FastifyBaseLogger;
  db: SqliteDatabase;
}

/**
 * Shared context factory used by both tRPC procedures and Fastify routes.
 * This ensures consistent context DI across the entire application.
 */
export async function createAppContext({
  req,
  res,
  db = getDbClient(),
}: {
  req: FastifyRequest;
  res: FastifyReply;
  db?: SqliteDatabase | Promise<SqliteDatabase>;
}): Promise<AppContext> {
  return { req, res, db: await db, logger: req.log };
}

export async function createTestAppContext(
  testDb: SqliteDatabase
): Promise<AppContext> {
  const mockLogger = {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
  };

  const mockReq = {
    log: mockLogger,
  } as unknown as FastifyRequest;

  const mockRes = {
    type: () => mockRes,
    send: () => mockRes,
    code: () => mockRes,
  } as unknown as FastifyReply;

  return createAppContext({ req: mockReq, res: mockRes, db: testDb });
}
