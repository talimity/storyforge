import { z } from "zod";

// Input schemas
export const modelsQuerySchema = z.object({
  filter: z.string().optional(),
  provider: z.string().optional(),
});

export const renderPromptQuerySchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
});

export const sectionSchema = z.object({
  id: z.string(),
  content: z.string(),
  metadata: z
    .object({
      role: z.enum(["system", "reference", "history", "task"]).optional(),
      priority: z.number().optional(),
    })
    .optional(),
});

export const parametersSchema = z.object({
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  stopSequences: z.array(z.string()).optional(),
});

export const completionSchema = z.object({
  sections: z.array(sectionSchema).optional(),
  parameters: parametersSchema.optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  stream: z.boolean().optional(),
});

// Response schemas
export const modelsResponseSchema = z.union([
  z.object({
    models: z.array(z.string()),
    count: z.number(),
    provider: z.string(),
  }),
  z.object({
    providers: z.array(
      z.object({
        provider: z.string(),
        models: z.array(z.string()),
      })
    ),
  }),
]);

export const completionResponseSchema = z.union([
  z.object({
    text: z.string(),
    metadata: z.any().optional(),
    prompt: z.string(),
    provider: z.string(),
  }),
  z.instanceof(ReadableStream),
]);

export const renderPromptResponseSchema = z.object({
  context: z.any(),
  chatRequest: z.any(),
  rendered: z.string(),
  provider: z.string(),
});

// Export inferred types
export type ModelsQuery = z.infer<typeof modelsQuerySchema>;
export type RenderPromptQuery = z.infer<typeof renderPromptQuerySchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Parameters = z.infer<typeof parametersSchema>;
export type CompletionInput = z.infer<typeof completionSchema>;
export type ModelsResponse = z.infer<typeof modelsResponseSchema>;
export type CompletionResponse = z.infer<typeof completionResponseSchema>;
export type RenderPromptResponse = z.infer<typeof renderPromptResponseSchema>;
