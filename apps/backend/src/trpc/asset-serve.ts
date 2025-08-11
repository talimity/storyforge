import { CharacterRepository } from "@storyforge/db";
import type { FastifyInstance } from "fastify";
import { getCharaAvatarCrop } from "@/shelf/character/character-image.service";

export function registerAssetServeRoute(fastify: FastifyInstance) {
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

  fastify.get("/api/characters/:id/avatar", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { db } = request.appContext;
    const characterRepository = new CharacterRepository(db);

    try {
      const character = await characterRepository.findById(id);
      if (!character || !character.cardImage) {
        return fastify.httpErrors.notFound("Character or avatar not found");
      }

      const focalPoint = character.cardFocalPoint;
      const croppedImage = await getCharaAvatarCrop(
        character.cardImage,
        focalPoint
      );

      reply.type("image/jpg");
      return reply.send(croppedImage);
    } catch (error) {
      fastify.log.error(error, "Error serving character avatar");
      return fastify.httpErrors.internalServerError(
        error instanceof Error ? error.message : "Failed to serve avatar"
      );
    }
  });
}
