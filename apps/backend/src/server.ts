import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { config } from "./config";
import { logger } from "./logging";
import { scenariosRoutes } from "./routes/scenarios";
import { charactersRoutes } from "./routes/characters";
import { lorebooksRoutes } from "./routes/lorebooks";

const fastify = Fastify({
  logger,
});

await fastify.register(cors, {
  origin: ["http://localhost:5173", "http://localhost:8080"],
  credentials: true,
});

await fastify.register(multipart);

fastify.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

await fastify.register(scenariosRoutes);
await fastify.register(charactersRoutes);
await fastify.register(lorebooksRoutes);

const start = async () => {
  try {
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });
    logger.info(
      `🚀 Backend server running on http://${config.server.host}:${config.server.port}`
    );
    logger.info(`🔑 LLM Provider: ${config.llm.defaultProvider}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
