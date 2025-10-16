import {
  characterAutocompleteInputSchema,
  characterAutocompleteResponseSchema,
  characterColorPaletteResponseSchema,
  characterIdSchema,
  characterIdsSchema,
  characterImportResponseSchema,
  characterImportSchema,
  characterSchema,
  characterSummarySchema,
  charactersListQuerySchema,
  charactersListResponseSchema,
  characterWithRelationsSchema,
  createCharacterSchema,
  focalPointSchema,
  setCharacterStarredSchema,
  updateCharacterSchema,
} from "@storyforge/contracts";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getCharacterDetail,
  getCharacters,
  listCharacters,
  searchCharacters,
  setCharacterStarred,
} from "../../services/character/character.queries.js";
import { transformCharacter } from "../../services/character/character.transforms.js";
import { CharacterService } from "../../services/character/character-service.js";
import { DEFAULT_CHARACTER_COLOR } from "../../services/character/utils/color.js";
import {
  getColorsFromCharaImage,
  maybeProcessCharaImage,
} from "../../services/character/utils/portraits.js";
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
    .input(charactersListQuerySchema.optional())
    .output(charactersListResponseSchema)
    .query(async ({ ctx, input }) => {
      const characters = await listCharacters(ctx.db, input);
      return { characters };
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

      const charaImageData = await maybeProcessCharaImage(imageDataUri);
      const charaSvc = new CharacterService(ctx.db);
      const newCharacter = await charaSvc.createCharacter({
        characterData: { ...input, ...charaImageData },
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
      const updatedCharacter = await charaSvc.updateCharacter(input);

      if (!updatedCharacter) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found",
        });
      }

      return transformCharacter(updatedCharacter);
    }),

  setStarred: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/characters/{id}/starred",
        tags: ["characters"],
        summary: "Set character starred state",
      },
    })
    .input(setCharacterStarredSchema)
    .output(z.object({ id: z.string(), isStarred: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const updated = await setCharacterStarred(ctx.db, input);
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found",
        });
      }

      return { id: updated.id, isStarred: Boolean(updated.isStarred) };
    }),

  resetPortraitCrop: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/characters/{id}/portrait/reset",
        tags: ["characters"],
        summary: "Resets the portrait crop to the auto-detected focal point",
      },
    })
    .input(characterIdSchema)
    .output(focalPointSchema)
    .mutation(async ({ input, ctx }) => {
      const charaSvc = new CharacterService(ctx.db);
      const focalPoint = await charaSvc.detectPortraitFocalPoint(input.id);

      if (!focalPoint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character portrait not found",
        });
      }

      return focalPoint;
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

  colorPalette: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/characters/{id}/color-palette",
        tags: ["characters"],
        summary: "Gets the color palette for a character's portrait",
      },
    })
    .input(characterIdSchema)
    .output(characterColorPaletteResponseSchema)
    .query(async ({ input, ctx }) => {
      const chara = await getCharacterDetail(ctx.db, input.id);

      if (!chara) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
      }

      if (!chara.portrait) {
        return {
          current: chara.defaultColor,
          palette: Array.from(new Set([chara.defaultColor, DEFAULT_CHARACTER_COLOR])),
        };
      }

      const colors = await getColorsFromCharaImage(chara.portrait, chara.portraitFocalPoint);
      if (!colors.includes(chara.defaultColor)) {
        colors.unshift(chara.defaultColor);
      }

      return { current: chara.defaultColor, palette: colors };
    }),
});
