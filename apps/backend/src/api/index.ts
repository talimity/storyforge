import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { OpenApiMeta } from "trpc-to-openapi";
import type { AppContext } from "@/api/app-context";
import { engineErrorToTRPC } from "@/api/engine-error-to-trpc";
import { serviceErrorToTRPC } from "@/api/service-error-to-trpc";
import { EngineError } from "@/engine/engine-error";
import { ServiceError } from "@/service-error";

const t = initTRPC
  .context<AppContext>()
  .meta<OpenApiMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape }) {
      return shape;
    },
  });

const mapEngineErrors = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (e) {
    // TODO: these are not being caught by the tRPC error handler correctly,
    // this is supposed to be an error formatter instead of a middleware

    if (e && e instanceof EngineError) {
      engineErrorToTRPC(e);
    } else if (e && e instanceof ServiceError) {
      serviceErrorToTRPC(e);
    }
    // Not a domain error: let tRPC handle it
    throw e;
  }
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure.use(mapEngineErrors);
