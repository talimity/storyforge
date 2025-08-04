import type { FastifyInstance } from "fastify";
import { characterRepository } from "../shelf/character/character.repository";
import { CharacterImportService } from "../shelf/character/character-import.service";
import { parseTavernCard } from "../shelf/character/parse-tavern-card";
import { toCharacter } from "./routers/characters";

export async function registerFileUploadRoutes(fastify: FastifyInstance) {
  // Handle file uploads outside of tRPC since tRPC doesn't handle multipart well
  fastify.post("/api/characters/import", async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: "No file provided" });
    }

    if (data.mimetype !== "image/png") {
      return reply.code(400).send({ error: "File must be a PNG image" });
    }

    try {
      const buffer = await data.toBuffer();
      const parsedCard = await parseTavernCard(buffer.buffer);
      const importService = new CharacterImportService();
      const characterId = await importService.importCharacter(
        parsedCard.cardData,
        buffer
      );

      const character =
        await characterRepository.findByIdWithRelations(characterId);

      if (!character) {
        throw new Error("Failed to retrieve imported character");
      }

      // Return the same shape as the tRPC endpoint would
      return {
        success: true,
        character: toCharacter(character),
        greetings: character.greetings,
        examples: character.examples,
        isV2: parsedCard.isV2,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "Import failed",
      });
    }
  });
}
