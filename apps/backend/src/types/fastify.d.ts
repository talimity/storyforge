import type { AppContext } from "../app-context";

declare module "fastify" {
  interface FastifyRequest {
    appContext: AppContext;
  }
}
