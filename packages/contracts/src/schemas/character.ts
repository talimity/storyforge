import { z } from "zod";
import { imageDataUriSchema } from "../utils/data-uri-validation.js";

export const cardTypeSchema = z.enum(["character", "group", "persona", "scenario"]);
export type CardType = z.infer<typeof cardTypeSchema>;

// Input schemas
export const characterIdSchema = z.object({
  id: z.string().min(1),
});

export const characterIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export const createCharacterSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  cardType: cardTypeSchema.default("character"),
  imageDataUri: imageDataUriSchema.nullish(),
  legacyPersonality: z.string().nullish(),
  legacyScenario: z.string().nullish(),
  creator: z.string().nullish(),
  creatorNotes: z.string().nullish(),
  customSystemPrompt: z.string().nullish(),
  styleInstructions: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  revision: z.string().default("1.0"),
  // Form-provided starters for create
  starters: z
    .array(
      z.object({
        id: z.string().optional(),
        message: z.string().min(1),
        isPrimary: z.boolean(),
      })
    )
    .default([]),
});

export const updateCharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  cardType: cardTypeSchema.optional(),
  imageDataUri: imageDataUriSchema.nullish(),
  styleInstructions: z.string().optional().nullable(),
  // Form-provided starters for update (optional)
  starters: z
    .array(
      z.object({
        id: z.string().optional(),
        message: z.string().min(1),
        isPrimary: z.boolean(),
      })
    )
    .optional(),
});

// Core entity schemas
export const characterStarterSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  message: z.string(),
  isPrimary: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
// Input DTO used by forms/routers
export const characterStarterInputSchema = z.object({
  id: z.string().optional(),
  message: z.string().min(1),
  isPrimary: z.boolean(),
});

export const characterExampleSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  exampleTemplate: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const characterSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  cardType: cardTypeSchema,
  legacyPersonality: z.string().nullable(),
  legacyScenario: z.string().nullable(),
  creator: z.string().nullable(),
  creatorNotes: z.string().nullable(),
  customSystemPrompt: z.string().nullable(),
  styleInstructions: z.string().nullable(),
  tags: z.array(z.string()),
  revision: z.string().nullable(),
  tavernCardData: z.any().nullable(),
  imagePath: z.string().nullable(),
  avatarPath: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const characterSummarySchema = characterSchema.pick({
  id: true,
  name: true,
  cardType: true,
  tags: true,
  creatorNotes: true,
  avatarPath: true,
  imagePath: true,
  createdAt: true,
  updatedAt: true,
});

export const characterWithRelationsSchema = characterSchema.extend({
  starters: z.array(characterStarterSchema),
  examples: z.array(characterExampleSchema),
});

export const characterImportSchema = z.object({
  charaDataUri: imageDataUriSchema,
});

// Response schemas
export const characterImportResponseSchema = z.object({
  success: z.boolean(),
  character: characterSchema,
});

export const charactersListResponseSchema = z.object({
  characters: z.array(characterSummarySchema),
});

export const characterAutocompleteInputSchema = z.object({
  name: z.string().default(""),
  filterMode: z.enum(["all", "inScenario", "notInScenario"]).default("all"),
  scenarioId: z.string().optional(),
});

export const characterAutocompleteItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  imagePath: z.string().nullable(),
  avatarPath: z.string().nullable(),
  cardType: cardTypeSchema,
});

export const characterAutocompleteResponseSchema = z.object({
  characters: z.array(characterAutocompleteItemSchema),
});

// Export inferred types
export type Character = z.infer<typeof characterSchema>;
export type CharacterWithRelations = z.infer<typeof characterWithRelationsSchema>;
export type CharacterSummary = z.infer<typeof characterSummarySchema>;
export type CharacterStarter = z.infer<typeof characterStarterSchema>;
export type CharacterExample = z.infer<typeof characterExampleSchema>;
export type CharacterImportInput = z.infer<typeof characterImportSchema>;
export type CharacterImportResponse = z.infer<typeof characterImportResponseSchema>;
export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
export type CharactersListResponse = z.infer<typeof charactersListResponseSchema>;
export type CharacterAutocompleteInput = z.infer<typeof characterAutocompleteInputSchema>;
export type CharacterAutocompleteItem = z.infer<typeof characterAutocompleteItemSchema>;
export type CharacterAutocompleteResponse = z.infer<typeof characterAutocompleteResponseSchema>;
export type CharacterStarterInput = z.infer<typeof characterStarterInputSchema>;
