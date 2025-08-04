import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { config } from "./config";
import { logger } from "./logging";
import { registerAPI } from "./trpc/register";

const fastify = Fastify({
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
    : {
        level: config.logging.level,
      },
});

// Register plugins
await fastify.register(cors, {
  origin: ["http://localhost:5173", "http://localhost:8080"],
  credentials: true,
});
await fastify.register(multipart);
await fastify.register(websocket);

// Register API routes
await registerAPI(fastify);

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
