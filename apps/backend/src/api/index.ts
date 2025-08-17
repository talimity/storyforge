import { initTRPC } from "@trpc/server";
import type { OpenApiMeta } from "trpc-to-openapi";
import type { AppContext } from "@/api/app-context";
import { engineErrorToTRPC } from "@/api/engine-error-to-trpc";

const t = initTRPC
  .context<AppContext>()
  .meta<OpenApiMeta>()
  .create({
    errorFormatter({ shape }) {
      return shape;
    },
  });

const mapEngineErrors = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (e) {
    if (e && typeof e === "object" && "name" in e && e.name === "EngineError") {
      // Convert to tRPC error
      engineErrorToTRPC(e);
    }
    // Not a domain error: let tRPC handle it
    throw e;
  }
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure.use(mapEngineErrors);
