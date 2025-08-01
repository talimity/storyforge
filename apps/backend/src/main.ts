import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { config } from "./config";
import { logger } from "./logging";
import { routeRegistry } from "@/api";

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

await fastify.register(cors, {
  origin: ["http://localhost:5173", "http://localhost:8080"],
  credentials: true,
});

await fastify.register(multipart);

fastify.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

await fastify.register(routeRegistry, { prefix: "/api" });

const init = async () => {
  try {
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });
    logger.info(
      `Server running on http://${config.server.host}:${config.server.port}`
    );
    logger.info(`LLM Provider: ${config.llm.defaultProvider}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

init();
