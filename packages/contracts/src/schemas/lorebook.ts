import {
  activatedLoreEntrySchema,
  activatedLoreIndexSchema,
  lorebookActivationDebugResponseSchema,
  lorebookDataSchema,
  lorebookEntryEvaluationTraceSchema,
  lorebookEntrySchema,
  lorebookEvaluationTraceSchema,
} from "@storyforge/lorebooks";
import { z } from "zod";
import { fileDataUriSchema } from "../utils/data-uri-validation.js";

export const lorebookIdSchema = z.object({
  id: z.string().min(1),
});

export const createLorebookSchema = z.object({
  data: lorebookDataSchema,
  source: z.enum(["silly_v2", "character_book", "manual"]).optional(),
});

export const updateLorebookSchema = z.object({
  id: z.string().min(1),
  data: lorebookDataSchema,
});

export const importLorebookSchema = z.object({
  fileDataUri: fileDataUriSchema,
  filename: z.string().optional(),
});

export const importLorebookFromCharacterSchema = z.object({
  characterId: z.string().min(1),
  linkToCharacter: z.boolean().default(true),
});

export const lorebookSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  entryCount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const lorebookDetailSchema = lorebookSummarySchema.extend({
  data: lorebookDataSchema,
});

export const lorebookImportResultSchema = z.object({
  lorebook: lorebookDetailSchema,
  created: z.boolean(),
});

export const lorebooksListResponseSchema = z.object({
  lorebooks: z.array(lorebookSummarySchema),
});

export const lorebookSearchQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.number().int().min(1).max(50).optional().default(25),
});

export const lorebookSearchResponseSchema = z.object({
  lorebooks: z.array(lorebookSummarySchema),
});

export const scenarioLorebookItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  entryCount: z.number(),
  enabled: z.boolean(),
  orderIndex: z.number().int(),
});

export const scenarioLorebooksResponseSchema = z.object({
  lorebooks: z.array(scenarioLorebookItemSchema),
});

export const assignLorebookSchema = z.object({
  scenarioId: z.string().min(1),
  lorebookId: z.string().min(1),
  orderIndex: z.number().int().min(0).optional(),
});

export const unassignLorebookSchema = z.object({
  scenarioId: z.string().min(1),
  lorebookId: z.string().min(1),
});

export const reorderScenarioLorebooksSchema = z.object({
  scenarioId: z.string().min(1),
  orders: z
    .array(
      z.object({
        lorebookId: z.string().min(1),
        orderIndex: z.number().int().min(0),
      })
    )
    .min(1),
});

export const linkCharacterLorebookSchema = z.object({
  characterId: z.string().min(1),
  lorebookId: z.string().min(1),
});

export const unlinkCharacterLorebookSchema = linkCharacterLorebookSchema;

export const characterLorebooksResponseSchema = z.object({
  lorebooks: z.array(lorebookSummarySchema),
});

export type LorebookSummary = z.infer<typeof lorebookSummarySchema>;
export type LorebookDetail = z.infer<typeof lorebookDetailSchema>;
export type LorebookSearchQuery = z.infer<typeof lorebookSearchQuerySchema>;
export type AssignLorebookInput = z.infer<typeof assignLorebookSchema>;
export type ReorderScenarioLorebooksInput = z.infer<typeof reorderScenarioLorebooksSchema>;
export type LinkCharacterLorebookInput = z.infer<typeof linkCharacterLorebookSchema>;
export type ImportLorebookFromCharacterInput = z.infer<typeof importLorebookFromCharacterSchema>;
export type ImportLorebookInput = z.infer<typeof importLorebookSchema>;

export {
  lorebookEntrySchema,
  lorebookDataSchema,
  activatedLoreEntrySchema,
  activatedLoreIndexSchema,
  lorebookEntryEvaluationTraceSchema,
  lorebookEvaluationTraceSchema,
  lorebookActivationDebugResponseSchema,
};

export type {
  ActivatedLoreEntryContract,
  ActivatedLoreIndexContract,
  LorebookActivationDebugResponse,
  LorebookData,
  LorebookEntry,
  LorebookEntryEvaluationTraceContract,
  LorebookEvaluationTraceContract,
} from "@storyforge/lorebooks";
