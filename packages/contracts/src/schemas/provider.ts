import { textInferenceCapabilitiesSchema } from "@storyforge/inference";
import { z } from "zod";

// Core schemas
export const providerKindSchema = z.enum(["openrouter", "deepseek", "openai-compatible", "mock"]);

export const providerAuthOutputSchema = z.object({ hasApiKey: z.boolean() });
export const providerAuthInputSchema = z.object({
  apiKey: z.string().min(1).nullable(),
});

// Provider API schemas
export const providerConfigSchema = z.object({
  id: z.string(),
  kind: providerKindSchema,
  name: z.string().describe("User-friendly name for this provider instance"),
  auth: providerAuthOutputSchema,
  baseUrl: z
    .string()
    .nullable()
    .describe("Base URL for API requests (required for openai-compatible)"),
  capabilities: textInferenceCapabilitiesSchema
    .nullable()
    .describe("Override default capabilities (openai-compatible only)"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createProviderConfigSchema = z.object({
  kind: providerKindSchema,
  name: z.string().min(1).max(100),
  auth: providerAuthInputSchema,
  baseUrl: z.url().nullable(),
  capabilities: textInferenceCapabilitiesSchema.partial().nullable(),
});

export const updateProviderConfigSchema = z.object({
  id: z.string(),
  data: createProviderConfigSchema.extend({ auth: providerAuthInputSchema.partial() }).partial(),
});

export const listProvidersOutputSchema = z.object({
  providers: z.array(providerConfigSchema),
});

export const testProviderConnectionInputSchema = z.object({
  providerId: z.string(),
  modelProfileId: z.string(),
});

export const testProviderConnectionOutputSchema = z.object({
  success: z.boolean(),
  payload: z.any().nullable(),
});

// Model Profile API schemas
export const modelProfileSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  displayName: z.string().describe("User-friendly name for this model"),
  modelId: z.string().describe("Model identifier as used by the provider"),
  textTemplate: z.string().nullable().describe("Optional text completion template"),
  modelInstruction: z
    .string()
    .nullable()
    .describe("Optional model-specific guidance injected into prompt globals"),
  capabilityOverrides: textInferenceCapabilitiesSchema
    .partial()
    .nullable()
    .describe("Override provider capabilities for this specific model"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createModelProfileSchema = z.object({
  providerId: z.string(),
  displayName: z.string().min(1).max(100),
  modelId: z.string().min(1).max(200),
  textTemplate: z.string().nullable(),
  modelInstruction: z.string().nullable(),
  capabilityOverrides: textInferenceCapabilitiesSchema.partial().nullable(),
});

export const updateModelProfileSchema = createModelProfileSchema.partial();

export const listModelProfilesOutputSchema = z.object({
  modelProfiles: z.array(modelProfileSchema),
});

// Model Search API schemas
export const modelSearchResultSchema = z.object({
  id: z.string().describe("Model ID as used by the provider"),
  name: z.string().nullable().describe("Display name if different from ID"),
  description: z.string().nullable(),
  contextLength: z.number().nullable(),
  tags: z.array(z.string()).nullable(),
});

export const searchModelsInputSchema = z.object({
  providerId: z.string(),
  query: z.string().optional().describe("Search query to filter models"),
});

export const searchModelsOutputSchema = z.object({
  models: z.array(modelSearchResultSchema),
});

export type ProviderKind = z.infer<typeof providerKindSchema>;
export type ProviderAuth = z.infer<typeof providerAuthOutputSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type CreateProviderConfig = z.infer<typeof createProviderConfigSchema>;
export type UpdateProviderConfig = z.infer<typeof updateProviderConfigSchema>;
export type ListProvidersOutput = z.infer<typeof listProvidersOutputSchema>;
export type TestProviderConnectionInput = z.infer<typeof testProviderConnectionInputSchema>;
export type TestProviderConnectionOutput = z.infer<typeof testProviderConnectionOutputSchema>;
export type ModelProfile = z.infer<typeof modelProfileSchema>;
export type CreateModelProfile = z.infer<typeof createModelProfileSchema>;
export type UpdateModelProfile = z.infer<typeof updateModelProfileSchema>;
export type ListModelProfilesOutput = z.infer<typeof listModelProfilesOutputSchema>;

// Model Profile search (server-side)
export const searchModelProfilesInputSchema = z.object({
  q: z.string().optional().default(""),
  limit: z.number().int().min(1).max(50).optional().default(25),
});

export const searchModelProfilesOutputSchema = listModelProfilesOutputSchema;

export type SearchModelProfilesInput = z.infer<typeof searchModelProfilesInputSchema>;
export type SearchModelProfilesOutput = z.infer<typeof searchModelProfilesOutputSchema>;
export type ModelSearchResult = z.infer<typeof modelSearchResultSchema>;
export type SearchModelsInput = z.infer<typeof searchModelsInputSchema>;
export type SearchModelsOutput = z.infer<typeof searchModelsOutputSchema>;
