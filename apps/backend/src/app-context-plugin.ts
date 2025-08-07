import { db as dbClient, type StoryforgeSqliteDatabase } from "@storyforge/db";
import fp from "fastify-plugin";
import { createAppContext, createTestAppContext } from "./trpc/app-context";

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

export const testAppContextPlugin = fp<AppContextPluginOptions>(
  async (fastify, options) => {
    fastify.decorateRequest("appContext");
    fastify.addHook("onRequest", async (req, _res) => {
      req.appContext = createTestAppContext(options.db || dbClient);
    });
  }
);
