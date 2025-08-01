import { charactersRoutes } from "@/api/http/characters";
import { FastifyInstance } from "fastify";

export const routeRegistry = async (fastify: FastifyInstance) => {
  fastify.register(charactersRoutes);
};
