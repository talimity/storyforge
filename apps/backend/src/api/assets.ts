import type { FastifyInstance } from "fastify";
import { getCharacterPortrait } from "../services/character/character.queries.js";
import { getCharaAvatarCrop } from "../services/character/utils/face-detection.js";

export function registerAssetsRoutes(fastify: FastifyInstance) {
  fastify.get("/assets/characters/:id/card", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { db } = request.server;

    try {
      const data = await getCharacterPortrait(db, id);

      if (!data?.portrait) {
        return fastify.httpErrors.notFound("Character or image not found");
      }

      reply.type("image/png");
      return reply.send(data.portrait);
    } catch (error) {
      fastify.log.error(error, "Error serving character image");
      return fastify.httpErrors.internalServerError(
        error instanceof Error ? error.message : "Failed to serve image"
      );
    }
  });

  fastify.get("/assets/characters/:id/avatar", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { db } = request.server;

    try {
      const data = await getCharacterPortrait(db, id);
      if (!data?.portrait) {
        return fastify.httpErrors.notFound("Character or image not found");
      }

      const { portrait, focalPoint } = data;
      const croppedImage = await getCharaAvatarCrop(portrait, focalPoint);

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
