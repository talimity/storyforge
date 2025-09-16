import {
  characterAutocompleteInputSchema,
  characterAutocompleteResponseSchema,
  characterIdSchema,
  characterIdsSchema,
  characterImportResponseSchema,
  characterImportSchema,
  characterSchema,
  characterSummarySchema,
  charactersListResponseSchema,
  characterWithRelationsSchema,
  createCharacterSchema,
  updateCharacterSchema,
} from "@storyforge/contracts";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getCharacterDetail,
  getCharacters,
  listCharacters,
  searchCharacters,
} from "../../services/character/character.queries.js";
import { transformCharacter } from "../../services/character/character.transforms.js";
import { CharacterService } from "../../services/character/character-service.js";
import { maybeProcessCharaImage } from "../../services/character/utils/face-detection.js";
import { publicProcedure, router } from "../index.js";

// Note: this router is old, don't use it as a reference

export const charactersRouter = router({
  list: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/characters",
        tags: ["characters"],
        summary: "Returns all characters",
      },
    })
    .input(z.void())
    .output(charactersListResponseSchema)
    .query(async ({ ctx }) => {
      const characters = await listCharacters(ctx.db);
      return { characters: characters.map(transformCharacter) };
    }),

  search: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/characters/search",
        tags: ["characters"],
        summary: "Searches characters for autocomplete",
      },
    })
    .input(characterAutocompleteInputSchema)
    .output(characterAutocompleteResponseSchema)
    .query(async ({ input, ctx }) => {
      const characters = await searchCharacters(ctx.db, {
        name: input.name || "",
        filterMode: input.filterMode || "all",
        scenarioId: input.scenarioId,
      });
      return { characters };
    }),

  getById: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/characters/{id}",
        tags: ["characters"],
        summary: "Gets character by ID",
      },
    })
    .input(characterIdSchema)
    .output(characterWithRelationsSchema)
    .query(async ({ input, ctx }) => {
      const character = await getCharacterDetail(ctx.db, input.id);

      if (!character) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found",
        });
      }

      return {
        ...transformCharacter(character),
        starters: character.starters,
        examples: character.examples,
      };
    }),

  getByIds: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/characters/by-ids",
        tags: ["characters"],
        summary: "Gets characters by IDs",
      },
    })
    .input(characterIdsSchema)
    .output(z.object({ characters: z.array(characterSummarySchema) }))
    .query(async ({ input, ctx }) => {
      const characters = await getCharacters(ctx.db, input.ids);
      return { characters: characters.map(transformCharacter) };
    }),

  import: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/characters/import",
        tags: ["characters"],
        summary: "Imports a character from a file",
      },
    })
    .input(characterImportSchema)
    .output(characterImportResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const { charaDataUri } = input;

      try {
        const buffer = Buffer.from(charaDataUri.split(",")[1], "base64");
        const charaSvc = new CharacterService(ctx.db);
        const newChara = await charaSvc.importCharacterFromTavernCard(buffer);

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
        summary: "Creates a new character",
      },
    })
    .input(createCharacterSchema)
    .output(characterWithRelationsSchema)
    .mutation(async ({ input: rawInput, ctx }) => {
      const {
        imageDataUri,
        starters = [],
        ...input
      } = rawInput as z.infer<typeof createCharacterSchema>;

      const charaSvc = new CharacterService(ctx.db);
      const newCharacter = await charaSvc.createCharacter({
        characterData: {
          ...input,
          ...(await maybeProcessCharaImage(imageDataUri)),
        },
        starters: starters.map((s) => ({ message: s.message, isPrimary: s.isPrimary })),
      });

      return {
        ...transformCharacter(newCharacter),
        starters: newCharacter.starters,
        examples: newCharacter.examples,
      };
    }),

  update: publicProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/api/characters/{id}",
        tags: ["characters"],
        summary: "Updates a character",
      },
    })
    .input(updateCharacterSchema)
    .output(characterSchema)
    .mutation(async ({ input, ctx }) => {
      const charaSvc = new CharacterService(ctx.db);
      const { id, imageDataUri, starters, portraitFocalPoint, ...updates } = input;

      // Map imageDataUri tri-state to DB updates:
      // - undefined: keep existing portrait
      // - null: remove portrait
      // - string: new portrait (processed)
      const imageUpdate =
        imageDataUri === undefined
          ? {}
          : imageDataUri === null
            ? { portrait: null }
            : await maybeProcessCharaImage(imageDataUri);

      const updatedCharacter = await charaSvc.updateCharacter(id, {
        ...updates,
        ...(imageUpdate ?? {}),
        ...(portraitFocalPoint ? { portraitFocalPoint } : {}),
      });

      if (!updatedCharacter) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found",
        });
      }

      if (starters) {
        await charaSvc.setCharacterStarters(id, starters);
      }

      return transformCharacter(updatedCharacter);
    }),

  delete: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/characters/{id}",
        tags: ["characters"],
        summary: "Deletes a character",
      },
    })
    .input(characterIdSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const charaSvc = new CharacterService(ctx.db);
      const deleted = await charaSvc.deleteCharacter(input.id);

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found",
        });
      }
    }),
});
