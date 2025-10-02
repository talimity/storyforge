import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getCharacterPortrait } from "../services/character/character.queries.js";
import { getCharaAssetCacheKey } from "../services/character/utils/chara-asset-helpers.js";
import { getCharaAvatarCrop } from "../services/character/utils/face-detection.js";

const cacheBustingQuerySchema = z.object({
  cb: z.string().optional(),
});

const cardQuerySchema = cacheBustingQuerySchema.extend({
  q: z.string().optional(),
});

let sharpInstance: typeof import("sharp") | undefined;

async function getSharp() {
  sharpInstance = sharpInstance ?? (await import("sharp")).default;
  return sharpInstance;
}

function sanitizeEtagSegment(segment: string) {
  if (segment.length === 0) {
    return "";
  }

  if (!segment.includes('"') && !segment.includes("\\")) {
    return segment;
  }

  const encoded = Buffer.from(segment, "utf8").toString("base64");
  return `b64:${encoded}`;
}

function applyAssetCacheHeaders(
  request: FastifyRequest,
  reply: FastifyReply,
  options: {
    responseCacheKey: string | null;
    requestCacheKey: string | null;
    variantKey?: string | null;
  }
) {
  const { responseCacheKey, requestCacheKey, variantKey } = options;

  if (!responseCacheKey || requestCacheKey !== responseCacheKey) {
    reply.header("Cache-Control", "no-store");
    return { isNotModified: false } as const;
  }

  const normalizedVariant = typeof variantKey === "string" ? sanitizeEtagSegment(variantKey) : null;
  const variantSuffix =
    normalizedVariant && normalizedVariant.length > 0 ? `:${normalizedVariant}` : "";
  const etagValue = `"${responseCacheKey}${variantSuffix}"`;
  reply.header("Cache-Control", "public, max-age=31536000, immutable");
  reply.header("ETag", etagValue);

  const headerValue = request.headers["if-none-match"];
  if (typeof headerValue !== "string") {
    return { isNotModified: false } as const;
  }

  const tokens = headerValue
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => (token.startsWith("W/") ? token.slice(2) : token));

  if (tokens.includes(etagValue)) {
    return { isNotModified: true } as const;
  }

  return { isNotModified: false } as const;
}

export function registerAssetsRoutes(fastify: FastifyInstance) {
  fastify.get("/assets/characters/:id/card", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { db } = request.server;

    try {
      const parsedQuery = cardQuerySchema.safeParse(request.query);
      const requestCacheKey =
        parsedQuery.success && parsedQuery.data.cb ? parsedQuery.data.cb : null;

      const qualitySetting = (() => {
        if (!parsedQuery.success) {
          return { mode: "jpeg" as const, quality: 88, variant: "q88" };
        }

        const raw = parsedQuery.data.q;
        if (raw === undefined) {
          return { mode: "jpeg" as const, quality: 88, variant: "q88" };
        }

        if (raw === "original") {
          return { mode: "original" as const, variant: "original" };
        }

        const parsedQuality = Number.parseInt(raw, 10);
        if (Number.isNaN(parsedQuality)) {
          return { mode: "jpeg" as const, quality: 88, variant: "q88" };
        }

        const clamped = Math.min(100, Math.max(1, parsedQuality));
        return { mode: "jpeg" as const, quality: clamped, variant: `q${clamped}` };
      })();

      const data = await getCharacterPortrait(db, id);

      if (!data?.portrait) {
        return fastify.httpErrors.notFound("Character or image not found");
      }

      const responseCacheKey = getCharaAssetCacheKey(data);
      const cacheResult = applyAssetCacheHeaders(request, reply, {
        responseCacheKey,
        requestCacheKey,
        variantKey: qualitySetting.variant,
      });

      if (cacheResult.isNotModified) {
        reply.status(304);
        return reply.send();
      }

      if (qualitySetting.mode === "original") {
        reply.type("image/png");
        return reply.send(data.portrait);
      }

      const sharp = await getSharp();
      const converted = await sharp(data.portrait)
        .jpeg({ quality: qualitySetting.quality })
        .toBuffer();
      reply.type("image/jpeg");
      return reply.send(converted);
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

      const requestCacheKey = parsed.success && parsed.data.cb ? parsed.data.cb : null;
      const responseCacheKey = getCharaAssetCacheKey(data);
      const cacheResult = applyAssetCacheHeaders(request, reply, {
        responseCacheKey,
        requestCacheKey,
        variantKey: parsed.success
          ? JSON.stringify({
              x: parsed.data.x,
              y: parsed.data.y,
              w: parsed.data.w,
              h: parsed.data.h,
              padding,
              size: outputSize,
            })
          : null,
      });

      if (cacheResult.isNotModified) {
        reply.status(304);
        return reply.send();
      }

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
