import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { OpenApiMeta } from "trpc-to-openapi";
import { EngineError } from "../engine-error.js";
import { ServiceError } from "../service-error.js";
import { engineErrorToTRPC } from "./engine-error-to-trpc.js";
import { serviceErrorToTRPC } from "./service-error-to-trpc.js";
import type { TRPCContext } from "./trpc-context.js";

const t = initTRPC
  .context<TRPCContext>()
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
