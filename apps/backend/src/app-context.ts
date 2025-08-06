import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { StoryforgeSqliteDatabase } from "./db/client";
import { db as dbClient } from "./db/client";

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

export function createTestContext(
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

type AppContextPluginOptions = {
  /** Support database client DI for Fastify routes */
  db?: StoryforgeSqliteDatabase;
};

export const appContextPlugin = fp<AppContextPluginOptions>(
  async (fastify, options) => {
    fastify.decorateRequest("appContext");
    fastify.addHook("onRequest", async (req, res) => {
      req.appContext = createAppContext({ req, res, db: options.db });
    });
  }
);
