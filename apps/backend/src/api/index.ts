import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { OpenApiMeta } from "trpc-to-openapi";
import { EngineError } from "../engine-error.js";
import { ServiceError } from "../service-error.js";
import { engineErrorToTRPC } from "./engine-error-to-trpc.js";
import { serviceErrorToTRPC } from "./service-error-to-trpc.js";
import type { TRPCContext } from "./trpc-context.js";

const t = initTRPC.context<TRPCContext>().meta<OpenApiMeta>().create({
  transformer: superjson,
});

const errorHandlingProcedure = t.middleware(async ({ next, ctx }) => {
  const resp = await next();
  if (resp.ok) {
    return resp;
  }
  const e = resp.error.cause || resp.error;

  if (e && e instanceof EngineError) {
    engineErrorToTRPC(e);
  } else if (e && e instanceof ServiceError) {
    serviceErrorToTRPC(e);
  }

  ctx.logger.error({ error: e }, "Error in tRPC procedure");

  // Not a domain error: let tRPC handle it
  throw e;
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure.use(errorHandlingProcedure);
