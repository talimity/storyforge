import { charactersRoutes } from "@/api/http/characters";
import { debugRoutes } from "@/api/http/debug";
import { FastifyInstance } from "fastify";

export const routeRegistry = async (fastify: FastifyInstance) => {
  fastify.register(charactersRoutes);
  fastify.register(debugRoutes);
};
