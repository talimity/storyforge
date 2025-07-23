import Fastify from "fastify";
import cors from "@fastify/cors";
import { scenariosRoutes } from "./routes/scenarios";
import { charactersRoutes } from "./routes/characters";
import { lorebooksRoutes } from "./routes/lorebooks";

const fastify = Fastify({
  logger: true,
});

// Register CORS for frontend access
await fastify.register(cors, {
  origin: ["http://localhost:5173", "http://localhost:8080"],
  credentials: true,
});

fastify.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

await fastify.register(scenariosRoutes);
await fastify.register(charactersRoutes);
await fastify.register(lorebooksRoutes);

const start = async () => {
  try {
    await fastify.listen({
      port: 3001,
      host: "0.0.0.0",
    });
    console.log("🚀 Backend server running on http://localhost:3001");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
