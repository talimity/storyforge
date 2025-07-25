import { FastifyInstance } from "fastify";
import { characterRepository } from "../repositories";
import { Character } from "@storyforge/shared";

interface GetCharacterParams {
  id: string;
}

export async function charactersRoutes(fastify: FastifyInstance) {
  // Get all characters
  fastify.get("/api/characters", async () => {
    try {
      const characters = await characterRepository.findAll();
      return { characters };
    } catch (error) {
      fastify.log.error(error);
      throw new Error("Failed to fetch characters");
    }
  });

  // Get single character
  fastify.get<{ Params: GetCharacterParams }>(
    "/api/characters/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const character = await characterRepository.findById(id);

        if (!character) {
          return reply.code(404).send({ error: "Character not found" });
        }

        return character;
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to fetch character" });
      }
    }
  );

  // Create character
  fastify.post<{ Body: Omit<Character, "id"> }>(
    "/api/characters",
    async (request, reply) => {
      try {
        const newCharacter = await characterRepository.create({
          name: request.body.name,
          description: request.body.description,
          personality: request.body.personality,
          avatar: request.body.avatar,
        });

        return reply.code(201).send(newCharacter);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to create character" });
      }
    }
  );

  // Update character
  fastify.put<{ Params: GetCharacterParams; Body: Partial<Character> }>(
    "/api/characters/:id",
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
        if (request.body.personality !== undefined) {
          updateData.personality = request.body.personality;
        }
        if (request.body.avatar !== undefined) {
          updateData.avatar = request.body.avatar;
        }

        const updatedCharacter = await characterRepository.update(
          id,
          updateData
        );

        if (!updatedCharacter) {
          return reply.code(404).send({ error: "Character not found" });
        }

        return updatedCharacter;
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to update character" });
      }
    }
  );

  // Delete character
  fastify.delete<{ Params: GetCharacterParams }>(
    "/api/characters/:id",
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
}
