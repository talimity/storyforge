import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyInstance } from "fastify";
import { createOpenApiHttpHandler } from "trpc-to-openapi";
import { createAppContext } from "../app-context";
import { appRouter } from "./app-router";
import { registerFileUploadRoutes } from "./file-upload";
import { openApiDocument } from "./openapi";
import { registerSSERoutes } from "./sse";

/**
 * Register all tRPC and REST (via trpc-to-openapi) routes given a Fastify
 * instance.
 */
export async function registerAPI(fastify: FastifyInstance) {
  // Register non-tRPC routes for file uploads and SSE
  await registerFileUploadRoutes(fastify);
  await registerSSERoutes(fastify);

  // Register tRPC routers
  await fastify.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    useWSS: true,
    trpcOptions: {
      router: appRouter,
      createContext: createAppContext,
      onError({ error }: { error: Error }) {
        fastify.log.error({ error }, "tRPC error");
      },
    },
  });

  // Set up trpc-to-openapi for RESTful API endpoints
  const openApiHttpHandler = createOpenApiHttpHandler({
    router: appRouter,
    createContext: createAppContext,
    // biome-ignore lint/suspicious/noExplicitAny: trpc-to-openapi expects node:http types and does not like fastify
  } as any);
  fastify.all("/api/*", async (request, reply) => {
    // Forward the raw Node.js request/response objects to the OpenAPI handler
    // But ensure the parsed body from Fastify is available on the raw request
    if (request.body) {
      // biome-ignore lint/suspicious/noExplicitAny: janky trpc-to-openapi fastify integration
      (request.raw as any).body = request.body;
    }
    await openApiHttpHandler(request.raw, reply.raw);
  });

  // Serve OpenAPI spec
  fastify.get("/openapi.json", async () => openApiDocument);
}
