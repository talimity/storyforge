import { initTRPC } from "@trpc/server";
import type { OpenApiMeta } from "trpc-to-openapi";
import type { AppContext } from "../app-context";

const t = initTRPC
  .context<AppContext>()
  .meta<OpenApiMeta>()
  .create({
    errorFormatter({ shape }) {
      return shape;
    },
  });

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure;
