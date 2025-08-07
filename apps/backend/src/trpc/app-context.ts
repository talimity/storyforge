import type { StoryforgeSqliteDatabase } from "@storyforge/db";
import { db as dbClient } from "@storyforge/db";
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";

export interface AppContext {
  req: FastifyRequest;
  res: FastifyReply;
  logger: FastifyBaseLogger;
  db: StoryforgeSqliteDatabase;
}

/**
 * Shared context factory used by both tRPC procedures and Fastify routes.
 * This ensures consistent context DI across the entire application.
 */
export function createAppContext({
  req,
  res,
  db = dbClient,
}: {
  req: FastifyRequest;
  res: FastifyReply;
  db?: StoryforgeSqliteDatabase;
}): AppContext {
  return { req, res, db, logger: req.log };
}

export function createTestAppContext(
  testDb: StoryforgeSqliteDatabase
): AppContext {
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
    type: () => mockRes, // Chainable method for setting content type
    send: () => mockRes,
    code: () => mockRes,
  } as unknown as FastifyReply;

  return createAppContext({ req: mockReq, res: mockRes, db: testDb });
}
