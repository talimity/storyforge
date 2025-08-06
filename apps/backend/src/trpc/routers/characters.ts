import {
  characterIdSchema,
  characterSchema,
  charactersListResponseSchema,
  characterWithRelationsSchema,
  createCharacterSchema,
  updateCharacterSchema,
} from "@storyforge/api";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CharacterRepository } from "../../shelf/character/character.repository";
import { transformCharacter } from "../../shelf/character/character.transforms";
import { publicProcedure, router } from "../index";

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
    .query(async ({ ctx }) => {
      const characterRepository = new CharacterRepository(ctx.db);
      const characters = await characterRepository.findAll();
      return { characters: characters.map(transformCharacter) };
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
    .query(async ({ input, ctx }) => {
      const characterRepository = new CharacterRepository(ctx.db);
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
        ...transformCharacter(character),
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
    .mutation(async ({ input, ctx }) => {
      const characterRepository = new CharacterRepository(ctx.db);
      const newCharacter = await characterRepository.createWithRelations(input);

      return {
        ...transformCharacter(newCharacter),
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
    .mutation(async ({ input, ctx }) => {
      const characterRepository = new CharacterRepository(ctx.db);
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

      return transformCharacter(updatedCharacter);
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
    .mutation(async ({ input, ctx }) => {
      const characterRepository = new CharacterRepository(ctx.db);
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
      const characterRepository = new CharacterRepository(ctx.db);
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
