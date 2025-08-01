import { FastifyInstance } from "fastify";
import { characterRepository } from "@/shelf/character/character.repository";
import { CharacterDTO } from "@storyforge/shared";
import { CharacterCardParserService } from "@/shelf/character/character-card-parser.service";
import { CharacterImportService } from "@/shelf/character/character-import.service";
import { Character as DbCharacter } from "@/db/schema/characters";

function toCharacterDTO(dbCharacter: DbCharacter): CharacterDTO {
  const result: CharacterDTO = {
    id: dbCharacter.id,
    name: dbCharacter.name,
    description: dbCharacter.description,
    legacyPersonality: dbCharacter.legacyPersonality,
    legacyScenario: dbCharacter.legacyScenario,
    creator: dbCharacter.creator,
    creatorNotes: dbCharacter.creatorNotes,
    customSystemPrompt: dbCharacter.customSystemPrompt,
    customPostHistoryInstructions: dbCharacter.customPostHistoryInstructions,
    tags: dbCharacter.tags || [],
    sfCharaVersion: dbCharacter.sfCharaVersion,
    originalCardData: dbCharacter.originalCardData
      ? JSON.parse(JSON.stringify(dbCharacter.originalCardData))
      : null,
    imagePath: dbCharacter.cardImage
      ? `/api/characters/${dbCharacter.id}/image`
      : null,
    createdAt: dbCharacter.createdAt,
    updatedAt: dbCharacter.updatedAt,
  };
  return result;
}

interface GetCharacterParams {
  id: string;
}

export async function charactersRoutes(fastify: FastifyInstance) {
  fastify.get("/characters", async () => {
    try {
      const characters = await characterRepository.findAll();
      return { characters: characters.map(toCharacterDTO) };
    } catch (error) {
      fastify.log.error(error);
      throw new Error("Failed to fetch characters");
    }
  });

  fastify.get<{ Params: GetCharacterParams }>(
    "/characters/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const character = await characterRepository.findByIdWithRelations(id);

        if (!character) {
          return reply.code(404).send({ error: "Character not found" });
        }

        return {
          ...toCharacterDTO(character),
          greetings: character.greetings,
          examples: character.examples,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to fetch character" });
      }
    }
  );

  fastify.post<{ Body: Omit<CharacterDTO, "id"> }>(
    "/characters",
    async (request, reply) => {
      try {
        const newCharacter = await characterRepository.createWithRelations({
          ...request.body,
        });

        return reply.code(201).send({
          ...toCharacterDTO(newCharacter),
          greetings: newCharacter.greetings,
          examples: newCharacter.examples,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to create character" });
      }
    }
  );

  fastify.put<{ Params: GetCharacterParams; Body: Partial<CharacterDTO> }>(
    "/characters/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const updateData: Parameters<typeof characterRepository.update>[1] = {};

        if (request.body.name !== undefined) {
          updateData.name = request.body.name;
        }
        if (request.body.description !== undefined) {
          updateData.description = request.body.description;
        }
        // Legacy fields removed - personality and avatar are no longer directly updatable

        const updatedCharacter = await characterRepository.update(
          id,
          updateData
        );

        if (!updatedCharacter) {
          return reply.code(404).send({ error: "Character not found" });
        }

        return toCharacterDTO(updatedCharacter);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to update character" });
      }
    }
  );

  fastify.delete<{ Params: GetCharacterParams }>(
    "/characters/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const deleted = await characterRepository.delete(id);

        if (!deleted) {
          return reply.code(404).send({ error: "Character not found" });
        }

        return reply.code(204).send();
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to delete character" });
      }
    }
  );

  fastify.get<{ Params: GetCharacterParams }>(
    "/characters/:id/image",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const character = await characterRepository.findById(id);

        if (!character || !character.cardImage) {
          return reply
            .code(404)
            .send({ error: "Character or image not found" });
        }

        reply.type("image/png");
        return character.cardImage;
      } catch (error) {
        fastify.log.error(error);
        return reply
          .code(500)
          .send({ error: "Failed to fetch character image" });
      }
    }
  );

  fastify.post("/characters/import", async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: "No file provided" });
      }

      if (!data.mimetype || data.mimetype !== "image/png") {
        return reply.code(400).send({ error: "File must be a PNG image" });
      }

      const buffer = await data.toBuffer();
      const parsedCard = await CharacterCardParserService.parseFromBuffer(
        buffer.buffer
      );

      const importService = new CharacterImportService();

      const characterId = await importService.importCharacter(
        parsedCard.cardData,
        buffer
      );

      const character =
        await characterRepository.findByIdWithRelations(characterId);

      if (!character) {
        return reply
          .code(500)
          .send({ error: "Failed to retrieve imported character" });
      }

      return {
        success: true,
        character: toCharacterDTO(character),
        greetings: character.greetings,
        examples: character.examples,
        isV2: parsedCard.isV2,
      };
    } catch (error) {
      fastify.log.error(error);

      if (error instanceof Error) {
        return reply.code(400).send({ error: error.message });
      }

      return reply.code(500).send({ error: "Failed to import character card" });
    }
  });
}
