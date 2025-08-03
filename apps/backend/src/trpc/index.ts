import { initTRPC } from "@trpc/server";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import type { OpenApiMeta } from "trpc-to-openapi";

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  return {
    req,
    res,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC
  .context<Context>()
  .meta<OpenApiMeta>()
  .create({
    errorFormatter({ shape }) {
      return shape;
    },
  });

export const router = t.router;
export const publicProcedure = t.procedure;
