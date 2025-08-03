import {
  type Character,
  characterIdSchema,
  characterSchema,
  charactersListResponseSchema,
  characterWithRelationsSchema,
  createCharacterSchema,
  updateCharacterSchema,
} from "@storyforge/api";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Character as DbCharacter } from "@/db/schema/characters";
import { characterRepository } from "@/shelf/character/character.repository";
import { publicProcedure, router } from "../index";

export function toCharacter(dbCharacter: DbCharacter): Character {
  return {
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
}

export const charactersRouter = router({
  list: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/characters",
        tags: ["characters"],
        summary: "List all characters",
      },
    })
    .input(z.void())
    .output(charactersListResponseSchema)
    .query(async () => {
      const characters = await characterRepository.findAll();
      return { characters: characters.map(toCharacter) };
    }),

  getById: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/characters/{id}",
        tags: ["characters"],
        summary: "Get character by ID",
      },
    })
    .input(characterIdSchema)
    .output(characterWithRelationsSchema)
    .query(async ({ input }) => {
      const character = await characterRepository.findByIdWithRelations(
        input.id
      );

      if (!character) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found",
        });
      }

      return {
        ...toCharacter(character),
        greetings: character.greetings,
        examples: character.examples,
      };
    }),

  create: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/characters",
        tags: ["characters"],
        summary: "Create a new character",
      },
    })
    .input(createCharacterSchema)
    .output(characterWithRelationsSchema)
    .mutation(async ({ input }) => {
      const newCharacter = await characterRepository.createWithRelations(input);

      return {
        ...toCharacter(newCharacter),
        greetings: newCharacter.greetings,
        examples: newCharacter.examples,
      };
    }),

  update: publicProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/api/characters/{id}",
        tags: ["characters"],
        summary: "Update a character",
      },
    })
    .input(updateCharacterSchema)
    .output(characterSchema)
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;
      const filteredUpdateData: Record<string, string> = {};

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          filteredUpdateData[key] = value;
        }
      }

      const updatedCharacter = await characterRepository.update(
        id,
        filteredUpdateData
      );

      if (!updatedCharacter) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found",
        });
      }

      return toCharacter(updatedCharacter);
    }),

  delete: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/characters/{id}",
        tags: ["characters"],
        summary: "Delete a character",
      },
    })
    .input(characterIdSchema)
    .output(z.void())
    .mutation(async ({ input }) => {
      const deleted = await characterRepository.delete(input.id);

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found",
        });
      }
    }),

  getImage: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/characters/{id}/image",
        tags: ["characters"],
        summary: "Get character image",
      },
    })
    .input(characterIdSchema)
    .output(z.instanceof(Buffer))
    .query(async ({ input, ctx }) => {
      const character = await characterRepository.findById(input.id);

      if (!character || !character.cardImage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character or image not found",
        });
      }

      // Handle response type in context
      ctx.res.type("image/png");
      return character.cardImage;
    }),
});
