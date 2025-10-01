import { z } from "zod";
import { fileDataUriSchema } from "../utils/data-uri-validation.js";

export const sillyTavernMessageSchema = z
  .object({
    name: z.string(),
    mes: z.string(),
    is_user: z.boolean().nullish(),
    is_system: z.union([z.boolean(), z.string()]).nullish(),
    send_date: z.union([z.string(), z.number()]).nullish(),
    gen_started: z.string().nullish(),
    gen_finished: z.string().nullish(),
    force_avatar: z.string().nullish(),
    original_avatar: z.string().nullish(),
    extra: z
      .object({
        isSmallSys: z.boolean().nullish(),
        type: z.string().nullish(),
        api: z.string().nullish(),
        model: z.string().nullish(),
        reasoning: z.string().nullish(),
      })
      .nullish(),
    swipes: z.array(z.string()).nullish(),
    swipe_id: z.number().nullish(),
  })
  .loose();

export const chatImportAnalyzeInputSchema = z.object({
  fileDataUri: fileDataUriSchema,
});

export const detectedCharacterSchema = z.object({
  name: z.string(),
  messageCount: z.number(),
  suggestedCharacterId: z.string().nullable(),
  isUser: z.boolean(),
  isSystem: z.boolean(),
});

export const chatImportAnalyzeOutputSchema = z.object({
  success: z.boolean(),
  detectedCharacters: z.array(detectedCharacterSchema),
  totalMessages: z.number(),
  validMessages: z.number(),
  skippedMessages: z.number(),
  error: z.string().optional(),
});

export const characterMappingSchema = z.discriminatedUnion("targetType", [
  z.object({
    detectedName: z.string(),
    targetType: z.literal("character"),
    characterId: z.string(),
  }),
  z.object({
    detectedName: z.string(),
    targetType: z.literal("narrator"),
  }),
  z.object({
    detectedName: z.string(),
    targetType: z.literal("ignore"),
  }),
]);

export const chatImportExecuteInputSchema = z.object({
  fileDataUri: fileDataUriSchema,
  scenarioName: z.string().min(1).max(255),
  scenarioDescription: z.string().optional(),
  mappings: z.array(characterMappingSchema).min(1),
});

export const chatImportExecuteOutputSchema = z.object({
  scenarioId: z.string().optional(),
  turnCount: z.number().optional(),
  error: z.string().optional(),
});

export type SillyTavernMessage = z.infer<typeof sillyTavernMessageSchema>;
export type ChatImportAnalyzeInput = z.infer<typeof chatImportAnalyzeInputSchema>;
export type ChatImportAnalyzeOutput = z.infer<typeof chatImportAnalyzeOutputSchema>;
export type CharacterMapping = z.infer<typeof characterMappingSchema>;
export type ChatImportExecuteInput = z.infer<typeof chatImportExecuteInputSchema>;
export type ChatImportExecuteOutput = z.infer<typeof chatImportExecuteOutputSchema>;
