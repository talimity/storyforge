import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyInstance } from "fastify";
import { createOpenApiHttpHandler } from "trpc-to-openapi";
import { appRouter } from "./app-router";
import { createContext } from "./context";
import { registerFileUploadRoutes } from "./file-upload";
import { openApiDocument } from "./openapi";

/**
 * Register all tRPC and REST (via trpc-to-openapi) routes given a Fastify
 * instance.
 */
export async function registerAPI(fastify: FastifyInstance) {
  // Register file upload routes (outside tRPC for multipart handling)
  await registerFileUploadRoutes(fastify);

  // Register tRPC and enable WebSocket support for subscriptions
  await fastify.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    useWSS: true,
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ error }: { error: Error }) {
        fastify.log.error({ error }, "tRPC error");
      },
    },
  });

  // Create OpenAPI HTTP handler and register so we get REST endpoints for our
  // tRPC procedures
  const openApiHttpHandler = createOpenApiHttpHandler({
    router: appRouter,
    // biome-ignore lint/suspicious/noExplicitAny: We need to use any here for Fastify compatibility
    createContext: ({ req, res }) => ({ req: req as any, res: res as any }),
  });
  fastify.all("/api/*", async (request, reply) => {
    await openApiHttpHandler(request.raw, reply.raw);
    reply.sent = true;
  });

  // Serve a static OpenAPI document at /openapi.json
  fastify.get("/openapi.json", async () => openApiDocument);
}
