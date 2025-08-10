import {
  characterIdSchema,
  characterImportResponseSchema,
  characterImportSchema,
  characterSchema,
  charactersListResponseSchema,
  characterWithRelationsSchema,
  createCharacterSchema,
  updateCharacterSchema,
} from "@storyforge/api";
import { CharacterRepository } from "@storyforge/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { transformCharacter } from "@/shelf/character/character.transforms";
import { CharacterImportService } from "@/shelf/character/character-import.service";
import { parseTavernCard } from "@/shelf/character/parse-tavern-card";
import { publicProcedure, router } from "@/trpc/index";

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

  import: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/characters/import",
        tags: ["characters"],
        summary: "Import a character from a file",
      },
    })
    .input(characterImportSchema)
    .output(characterImportResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { charaDataUri } = input;

      try {
        const buffer = Buffer.from(charaDataUri.split(",")[1], "base64");
        const parsedCard = await parseTavernCard(buffer.buffer);
        const characterRepository = new CharacterRepository(ctx.db);
        const importService = new CharacterImportService(characterRepository);
        const newChara = await importService.importCharacter(
          parsedCard.cardData,
          buffer
        );

        return {
          success: true,
          characterId: newChara,
          character: transformCharacter(newChara),
        };
      } catch (error) {
        ctx.logger.error(error, "Error importing character from TavernCard");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to import character",
        });
      }
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
    .mutation(async ({ input: rawInput, ctx }) => {
      const { avatarDataUri, ...input } = rawInput;
      let cardImage: Buffer | undefined;

      if (avatarDataUri) {
        const base64Data = avatarDataUri.split(",")[1];
        cardImage = Buffer.from(base64Data, "base64");
      }

      const characterRepository = new CharacterRepository(ctx.db);
      const newCharacter = await characterRepository.createWithRelations({
        ...input,
        cardImage,
      });

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
});
