import { z } from "zod";

// Input schemas
export const characterIdSchema = z.object({
  id: z.string().min(1),
});

export const createCharacterSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  legacyPersonality: z.string().nullish(),
  legacyScenario: z.string().nullish(),
  creator: z.string().nullish(),
  creatorNotes: z.string().nullish(),
  customSystemPrompt: z.string().nullish(),
  customPostHistoryInstructions: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  revision: z.string().default("1.0"),
  originalCardData: z.any().nullish(),
});

export const updateCharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
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
  legacyPersonality: z.string().nullable(),
  legacyScenario: z.string().nullable(),
  creator: z.string().nullable(),
  creatorNotes: z.string().nullable(),
  customSystemPrompt: z.string().nullable(),
  customPostHistoryInstructions: z.string().nullable(),
  tags: z.array(z.string()),
  revision: z.string().nullable(),
  originalCardData: z.any().nullable(),
  imagePath: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const stubCharacterSchema = characterSchema.pick({
  id: true,
  name: true,
  tags: true,
  creatorNotes: true,
  imagePath: true,
  createdAt: true,
  updatedAt: true,
});

export const characterWithRelationsSchema = characterSchema.extend({
  greetings: z.array(characterGreetingSchema),
  examples: z.array(characterExampleSchema),
});

// File upload schema
export const characterImportSchema = z.object({
  fileBuffer: z.instanceof(Buffer),
  mimeType: z.string(),
});

// Response schemas
export const characterImportResponseSchema = z.object({
  success: z.boolean(),
  character: characterSchema,
  greetings: z.array(z.any()),
  examples: z.array(z.any()),
  isV2: z.boolean(),
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
