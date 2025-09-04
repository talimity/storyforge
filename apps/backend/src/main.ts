import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import websocket from "@fastify/websocket";
import { config } from "@storyforge/config";
import Fastify from "fastify";
import { FastifySSEPlugin } from "fastify-sse-v2";
import { registerAPI } from "./api/register.js";
import { logger } from "./logging.js";
import { resources } from "./resources.js";

const fastify = Fastify({
  bodyLimit: 1024 * 1024 * 15, // 15MB
  logger: config.logging.pretty
    ? {
        level: config.logging.level,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        },
      }
    : { level: config.logging.level },
});

// Plugins
fastify.register(cors, {
  origin: ["http://localhost:5173", "http://localhost:8080"],
  logLevel: "silent",
  credentials: true,
  maxAge: 86400,
});
fastify.register(sensible);
fastify.register(multipart);
fastify.register(websocket);
fastify.register(FastifySSEPlugin);

// Add context to all requests
fastify.register(resources);

// Entry point for all API/RPC routes
registerAPI(fastify);

// Health check
fastify.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

try {
  await fastify.listen({
    port: config.server.port,
    host: config.server.host,
  });
  logger.info(`Storyforge server started on port ${config.server.port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

export type { AppRouter } from "./api/app-router.js";
