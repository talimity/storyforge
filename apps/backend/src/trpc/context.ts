import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  return { req, res, logger: req.log };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
