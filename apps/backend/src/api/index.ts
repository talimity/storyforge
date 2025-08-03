import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyInstance } from "fastify";
import { createOpenApiHttpHandler } from "trpc-to-openapi";
import { createContext } from "@/trpc";
import { appRouter, openApiDocument } from "@/trpc/app-router";
import { registerFileUploadRoutes } from "./file-upload";

export async function registerAPI(fastify: FastifyInstance) {
  // Register file upload routes (outside tRPC)
  await registerFileUploadRoutes(fastify);

  // Register tRPC with WebSocket support for subscriptions
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

  // Create OpenAPI HTTP handler
  const openApiHttpHandler = createOpenApiHttpHandler({
    router: appRouter,
    // biome-ignore lint/suspicious/noExplicitAny: We need to use any here for Fastify compatibility
    createContext: ({ req, res }) => ({ req: req as any, res: res as any }),
  });

  // Register OpenAPI routes
  fastify.all("/api/*", async (request, reply) => {
    await openApiHttpHandler(request.raw, reply.raw);
    reply.sent = true;
  });

  // Serve OpenAPI spec
  fastify.get("/openapi.json", async () => {
    return openApiDocument;
  });
}
