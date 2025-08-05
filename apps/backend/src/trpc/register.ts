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
    createContext: async ({ req, res }) => {
      // For OpenAPI endpoints, we need to create a context that matches the tRPC context
      // The req/res here are Node.js IncomingMessage/ServerResponse objects
      // biome-ignore lint/suspicious/noExplicitAny: janky trpc-to-openapi fastify integration
      return createContext({ req, res } as any);
    },
  });
  fastify.all("/api/*", async (request, reply) => {
    // Forward the raw Node.js request/response objects to the OpenAPI handler
    // But ensure the parsed body from Fastify is available on the raw request
    if (request.body) {
      // biome-ignore lint/suspicious/noExplicitAny: janky trpc-to-openapi fastify integration
      (request.raw as any).body = request.body;
    }
    await openApiHttpHandler(request.raw, reply.raw);
  });

  // Serve a static OpenAPI document at /openapi.json
  fastify.get("/openapi.json", async () => openApiDocument);
}
