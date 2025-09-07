import { z } from "zod";
import { characterStarterSchema, characterSummarySchema } from "./character.js";

// Input schemas
export const scenarioIdSchema = z.object({
  id: z.string().min(1),
});

export const createScenarioSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000),
  status: z.enum(["active", "archived"]).default("active"),
  settings: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
  characterIds: z.array(z.string()).min(2, "A scenario requires at least 2 characters").default([]),
  userProxyCharacterId: z.string().optional(),
});

export const updateScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["active", "archived"]).optional(),
  settings: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
  participants: z
    .array(
      z.object({
        characterId: z.string(),
        role: z.string().optional(),
        isUserProxy: z.boolean().default(false),
      })
    )
    .optional(),
});

// Character participant schemas
export const assignCharacterSchema = z.object({
  scenarioId: z.string().min(1),
  characterId: z.string().min(1),
  role: z.string().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export const unassignCharacterSchema = z.object({
  scenarioId: z.string().min(1),
  characterId: z.string().min(1),
});

export const reorderCharactersSchema = z.object({
  scenarioId: z.string().min(1),
  characterOrders: z.array(
    z.object({
      characterId: z.string().min(1),
      orderIndex: z.number().int().min(0),
    })
  ),
});

// Output schemas
export const scenarioParticipantSchema = z.object({
  id: z.string(),
  role: z.string().nullish(),
  orderIndex: z.number(),
  isUserProxy: z.boolean(),
  character: characterSummarySchema, // Populated character data
});

export const scenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["active", "archived"]),
  settings: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const scenarioWithCharactersSchema = scenarioSchema.extend({
  characters: z.array(scenarioParticipantSchema),
});

export const scenariosListResponseSchema = z.object({
  scenarios: z.array(scenarioSchema),
});

export const scenariosWithCharactersListResponseSchema = z.object({
  scenarios: z.array(scenarioWithCharactersSchema),
});

// Search/autocomplete schemas (lightweight results)
export const scenarioSearchQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.number().int().min(1).max(50).optional().default(25),
  status: z.enum(["active", "archived"]).optional(),
});

export const scenarioSearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["active", "archived"]),
  updatedAt: z.date(),
});

export const scenarioSearchResponseSchema = z.object({
  scenarios: z.array(scenarioSearchResultSchema),
});

export const characterWithStartersSchema = z.object({
  character: characterSummarySchema,
  starters: z.array(characterStarterSchema),
});

export const scenarioCharacterStartersResponseSchema = z.object({
  charactersWithStarters: z.array(characterWithStartersSchema),
});

// Export inferred types
export type Scenario = z.infer<typeof scenarioSchema>;
export type ScenarioWithCharacters = z.infer<typeof scenarioWithCharactersSchema>;
export type ScenarioParticipant = z.infer<typeof scenarioParticipantSchema>;
export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
export type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>;
export type AssignCharacterInput = z.infer<typeof assignCharacterSchema>;
export type UnassignCharacterInput = z.infer<typeof unassignCharacterSchema>;
export type ReorderCharactersInput = z.infer<typeof reorderCharactersSchema>;
export type ScenariosListResponse = z.infer<typeof scenariosListResponseSchema>;
export type CharacterWithStarters = z.infer<typeof characterWithStartersSchema>;
export type ScenarioCharacterStartersResponse = z.infer<
  typeof scenarioCharacterStartersResponseSchema
>;
export type ScenarioSearchQuery = z.infer<typeof scenarioSearchQuerySchema>;
export type ScenarioSearchResult = z.infer<typeof scenarioSearchResultSchema>;
export type ScenarioSearchResponse = z.infer<typeof scenarioSearchResponseSchema>;
