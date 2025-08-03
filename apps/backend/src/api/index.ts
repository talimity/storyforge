import type { FastifyInstance } from "fastify";
import { charactersRoutes } from "@/api/http/characters";
import { debugRoutes } from "@/api/http/debug";

export const routeRegistry = async (fastify: FastifyInstance) => {
  fastify.register(charactersRoutes);
  fastify.register(debugRoutes);
};
