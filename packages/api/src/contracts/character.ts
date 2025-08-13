import { z } from "zod";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export const cardTypeSchema = z.enum([
  "character",
  "group",
  "persona",
  "scenario",
]);
export type CardType = z.infer<typeof cardTypeSchema>;

const imageInputSchema = z.string().refine(
  (val) => {
    const parts = val.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
    if (!parts) return false;

    // Validate size (base64 string length)
    const estSize = (parts[2].length * 3) / 4;
    if (estSize > MAX_IMAGE_SIZE) {
      console.error(
        `Size validation failed: ${estSize} bytes exceeds ${MAX_IMAGE_SIZE} bytes`
      );
      return false;
    }

    try {
      z.string().base64().parse(parts[2]);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Provided image must be a valid PNG/JPEG under 10MB" }
);

// Input schemas
export const characterIdSchema = z.object({
  id: z.string().min(1),
});

export const createCharacterSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  cardType: cardTypeSchema.default("character"),
  imageDataUri: imageInputSchema.nullish(),
  legacyPersonality: z.string().nullish(),
  legacyScenario: z.string().nullish(),
  creator: z.string().nullish(),
  creatorNotes: z.string().nullish(),
  customSystemPrompt: z.string().nullish(),
  customPostHistoryInstructions: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  revision: z.string().default("1.0"),
});

export const updateCharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  cardType: cardTypeSchema.optional(),
  imageDataUri: imageInputSchema.nullish(),
});

// Core entity schemas
export const characterGreetingSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  message: z.string(),
  isPrimary: z.boolean(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const characterExampleSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  exampleTemplate: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
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
  customPostHistoryInstructions: z.string().nullable(),
  tags: z.array(z.string()),
  revision: z.string().nullable(),
  tavernCardData: z.any().nullable(),
  imagePath: z.string().nullable(),
  avatarPath: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const stubCharacterSchema = characterSchema.pick({
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
  greetings: z.array(characterGreetingSchema),
  examples: z.array(characterExampleSchema),
});

export const characterImportSchema = z.object({
  charaDataUri: imageInputSchema,
});

// Response schemas
export const characterImportResponseSchema = z.object({
  success: z.boolean(),
  character: characterSchema,
});

export const charactersListResponseSchema = z.object({
  characters: z.array(stubCharacterSchema),
});

// Export inferred types
export type Character = z.infer<typeof characterSchema>;
export type CharacterWithRelations = z.infer<
  typeof characterWithRelationsSchema
>;
export type CharacterGreeting = z.infer<typeof characterGreetingSchema>;
export type CharacterExample = z.infer<typeof characterExampleSchema>;
export type CharacterImportInput = z.infer<typeof characterImportSchema>;
export type CharacterImportResponse = z.infer<
  typeof characterImportResponseSchema
>;
export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
export type CharactersListResponse = z.infer<
  typeof charactersListResponseSchema
>;
