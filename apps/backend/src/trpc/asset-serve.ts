import type { FastifyInstance } from "fastify";
import { CharacterRepository } from "../shelf/character/character.repository";

export function registerAssetServeRoute(fastify: FastifyInstance) {
  // Handle character image serving as binary data (bypasses tRPC serialization)
  fastify.get("/api/characters/:id/image", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { db } = request.appContext;
    const characterRepository = new CharacterRepository(db);

    try {
      const character = await characterRepository.findById(id);

      if (!character || !character.cardImage) {
        return fastify.httpErrors.notFound("Character or image not found");
      }

      reply.type("image/png");
      return reply.send(character.cardImage);
    } catch (error) {
      fastify.log.error(error, "Error serving character image");
      return fastify.httpErrors.internalServerError(
        error instanceof Error ? error.message : "Failed to serve image"
      );
    }
  });
}
