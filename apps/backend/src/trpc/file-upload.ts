import { CharacterRepository } from "@storyforge/db";
import type { FastifyInstance } from "fastify";
import { transformCharacter } from "../shelf/character/character.transforms";
import { CharacterImportService } from "../shelf/character/character-import.service";
import { parseTavernCard } from "../shelf/character/parse-tavern-card";

export function registerFileUploadRoutes(fastify: FastifyInstance) {
  // Handle file uploads outside of tRPC since tRPC doesn't handle multipart well
  fastify.post("/api/characters/import", async (req) => {
    const { db, logger } = req.appContext;
    const data = await req.file();

    if (!data) {
      throw fastify.httpErrors.badRequest("No file provided");
    }

    if (data.mimetype !== "image/png") {
      throw fastify.httpErrors.notAcceptable("File must be a PNG image");
    }

    try {
      const buffer = await data.toBuffer();
      const parsedCard = await parseTavernCard(buffer.buffer);
      const characterRepository = new CharacterRepository(db);
      const importService = new CharacterImportService(characterRepository);
      const characterId = await importService.importCharacter(
        parsedCard.cardData,
        buffer
      );
      const character =
        await characterRepository.findByIdWithRelations(characterId);

      if (!character) {
        throw fastify.httpErrors.notFound("Character not found");
      }

      // Return the same shape as the tRPC endpoint would
      return {
        success: true,
        character: transformCharacter(character),
        greetings: character.greetings,
        examples: character.examples,
        isV2: parsedCard.isV2,
      };
    } catch (error) {
      logger.error(error, "Failed to import character from file");
      throw fastify.httpErrors.internalServerError(
        error instanceof Error ? error.message : "Import failed"
      );
    }
  });
}
