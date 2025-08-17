import { getDbClient, type SqliteDatabase } from "@storyforge/db";
import fp from "fastify-plugin";
import { createAppContext, createTestAppContext } from "@/api/app-context";

type AppContextPluginOptions = {
  /** Support database client DI for Fastify routes */
  db?: SqliteDatabase;
};

export const appContextPlugin = fp<AppContextPluginOptions>(
  async (fastify, options) => {
    fastify.decorateRequest("appContext");
    fastify.addHook("onRequest", async (req, res) => {
      req.appContext = await createAppContext({ req, res, db: options.db });
    });
  }
);

export const testAppContextPlugin = fp<AppContextPluginOptions>(
  async (fastify, options) => {
    fastify.decorateRequest("appContext");
    fastify.addHook("onRequest", async (req, _res) => {
      req.appContext = await createTestAppContext(
        options.db || (await getDbClient())
      );
    });
  }
);
