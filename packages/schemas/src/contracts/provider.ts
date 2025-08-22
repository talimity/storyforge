import z from "zod";

// Core schemas
export const providerKindSchema = z.enum([
  "openrouter",
  "deepseek",
  "openai-compatible",
]);

export const textInferenceCapabilitiesSchema = z.object({
  streaming: z
    .boolean()
    .describe("Whether tokens can be streamed as they are generated"),
  assistantPrefill: z
    .boolean()
    .describe(
      "Whether the assistant message can be prefilled to guide generation"
    ),
  logprobs: z
    .boolean()
    .describe("Whether logprobs can be requested for generated tokens"),
  tools: z.boolean().describe("Whether tool use is supported"),
  fim: z
    .boolean()
    .describe("Whether filling in the middle of text is supported"),
});

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
    .optional()
    .describe("Base URL for API requests (required for openai-compatible)"),
  capabilities: textInferenceCapabilitiesSchema
    .optional()
    .describe("Override default capabilities (openai-compatible only)"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createProviderConfigSchema = z.object({
  kind: providerKindSchema,
  name: z.string().min(1).max(100),
  auth: providerAuthInputSchema,
  baseUrl: z.string().optional(),
  capabilities: textInferenceCapabilitiesSchema.partial().optional(),
});

export const updateProviderConfigSchema = createProviderConfigSchema.partial();

export const listProvidersOutputSchema = z.object({
  providers: z.array(providerConfigSchema),
});

export const testProviderConnectionInputSchema = z.object({
  providerId: z.string(),
});

export const testProviderConnectionOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

// Model Profile API schemas
export const modelProfileSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  displayName: z.string().describe("User-friendly name for this model"),
  modelId: z.string().describe("Model identifier as used by the provider"),
  capabilityOverrides: textInferenceCapabilitiesSchema
    .partial()
    .optional()
    .describe("Override provider capabilities for this specific model"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createModelProfileSchema = z.object({
  providerId: z.string(),
  displayName: z.string().min(1).max(100),
  modelId: z.string().min(1).max(200),
  capabilityOverrides: textInferenceCapabilitiesSchema.partial().optional(),
});

export const updateModelProfileSchema = createModelProfileSchema.partial();

export const listModelProfilesOutputSchema = z.object({
  modelProfiles: z.array(modelProfileSchema),
});

// Model Search API schemas
export const modelSearchResultSchema = z.object({
  id: z.string().describe("Model ID as used by the provider"),
  name: z.string().optional().describe("Display name if different from ID"),
  description: z.string().optional(),
  contextLength: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

export const searchModelsInputSchema = z.object({
  providerId: z.string(),
  query: z.string().optional().describe("Search query to filter models"),
});

export const searchModelsOutputSchema = z.object({
  models: z.array(modelSearchResultSchema),
});

export type ProviderKind = z.infer<typeof providerKindSchema>;
export type TextInferenceCapabilities = z.infer<
  typeof textInferenceCapabilitiesSchema
>;
export type ProviderAuth = z.infer<typeof providerAuthOutputSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type CreateProviderConfig = z.infer<typeof createProviderConfigSchema>;
export type UpdateProviderConfig = z.infer<typeof updateProviderConfigSchema>;
export type ListProvidersOutput = z.infer<typeof listProvidersOutputSchema>;
export type TestProviderConnectionInput = z.infer<
  typeof testProviderConnectionInputSchema
>;
export type TestProviderConnectionOutput = z.infer<
  typeof testProviderConnectionOutputSchema
>;
export type ModelProfile = z.infer<typeof modelProfileSchema>;
export type CreateModelProfile = z.infer<typeof createModelProfileSchema>;
export type UpdateModelProfile = z.infer<typeof updateModelProfileSchema>;
export type ListModelProfilesOutput = z.infer<
  typeof listModelProfilesOutputSchema
>;
export type ModelSearchResult = z.infer<typeof modelSearchResultSchema>;
export type SearchModelsInput = z.infer<typeof searchModelsInputSchema>;
export type SearchModelsOutput = z.infer<typeof searchModelsOutputSchema>;
