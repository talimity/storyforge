import type { FastifyInstance } from "fastify";
import { z } from "zod";
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

      // Optional focal override via query string for previewing crops client-side
      const querySchema = z.object({
        x: z.coerce.number().min(0).max(1).optional(),
        y: z.coerce.number().min(0).max(1).optional(),
        w: z.coerce.number().min(0).max(1).optional(),
        h: z.coerce.number().min(0).max(1).optional(),
        padding: z.coerce.number().min(1).max(3).optional(),
        size: z.coerce.number().min(32).max(1024).optional(),
        cb: z.string().optional(),
      });

      const parsed = querySchema.safeParse(request.query);

      const previewFocal =
        parsed.success &&
        parsed.data.x !== undefined &&
        parsed.data.y !== undefined &&
        parsed.data.w !== undefined &&
        parsed.data.h !== undefined
          ? {
              x: parsed.data.x,
              y: parsed.data.y,
              w: parsed.data.w,
              h: parsed.data.h,
            }
          : undefined;

      const outputSize = parsed.success && parsed.data.size !== undefined ? parsed.data.size : 200;
      const padding =
        parsed.success && parsed.data.padding !== undefined ? parsed.data.padding : 1.2;

      const croppedImage = await getCharaAvatarCrop(portrait, previewFocal ?? focalPoint, {
        outputSize,
        padding,
        allowUpscale: true,
      });

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
