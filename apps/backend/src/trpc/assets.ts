import { CharacterRepository } from "@storyforge/db";
import type { FastifyInstance } from "fastify";
import { getCharaAvatarCrop } from "@/shelf/character/character-image.service";

export function registerAssetsRoutes(fastify: FastifyInstance) {
  fastify.get("/assets/characters/:id/card", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { db } = request.appContext;
    const characterRepository = new CharacterRepository(db);

    try {
      const character = await characterRepository.findById(id);

      if (!character || !character.portrait) {
        return fastify.httpErrors.notFound("Character or image not found");
      }

      reply.type("image/png");
      return reply.send(character.portrait);
    } catch (error) {
      fastify.log.error(error, "Error serving character image");
      return fastify.httpErrors.internalServerError(
        error instanceof Error ? error.message : "Failed to serve image"
      );
    }
  });

  fastify.get("/assets/characters/:id/avatar", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { db } = request.appContext;
    const characterRepository = new CharacterRepository(db);

    try {
      const character = await characterRepository.findById(id);
      if (!character || !character.portrait) {
        return fastify.httpErrors.notFound("Character or avatar not found");
      }

      const focalPoint = character.portraitFocalPoint;
      const croppedImage = await getCharaAvatarCrop(
        character.portrait,
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
