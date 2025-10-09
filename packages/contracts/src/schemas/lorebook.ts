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

const manualScenarioLorebookItemSchema = z.object({
  kind: z.literal("manual"),
  manualAssignmentId: z.string(),
  lorebookId: z.string(),
  name: z.string(),
  entryCount: z.number(),
  enabled: z.boolean(),
  defaultEnabled: z.boolean(),
});

const characterScenarioLorebookItemSchema = z.object({
  kind: z.literal("character"),
  lorebookId: z.string(),
  name: z.string(),
  entryCount: z.number(),
  characterId: z.string(),
  characterLorebookId: z.string(),
  enabled: z.boolean(),
  defaultEnabled: z.boolean(),
  overrideEnabled: z.boolean().nullable(),
});

export const scenarioLorebookItemSchema = z.discriminatedUnion("kind", [
  manualScenarioLorebookItemSchema,
  characterScenarioLorebookItemSchema,
]);

const manualScenarioLorebookAssignmentInputSchema = z.object({
  kind: z.literal("manual"),
  lorebookId: z.string().min(1),
  enabled: z.boolean().default(true),
});

const characterScenarioLorebookAssignmentInputSchema = z.object({
  kind: z.literal("character"),
  characterLorebookId: z.string().min(1),
  enabled: z.boolean().default(true),
});

export const scenarioLorebookAssignmentInputSchema = z.discriminatedUnion("kind", [
  manualScenarioLorebookAssignmentInputSchema,
  characterScenarioLorebookAssignmentInputSchema,
]);

export const scenarioLorebooksResponseSchema = z.object({
  lorebooks: z.array(scenarioLorebookItemSchema),
});

export const assignScenarioManualLorebookSchema = z.object({
  scenarioId: z.string().min(1),
  lorebookId: z.string().min(1),
  enabled: z.boolean().optional(),
});

export const unassignScenarioManualLorebookSchema = z.object({
  scenarioId: z.string().min(1),
  lorebookId: z.string().min(1),
});

export const updateScenarioManualLorebookStateSchema = z.object({
  scenarioId: z.string().min(1),
  lorebookId: z.string().min(1),
  enabled: z.boolean(),
});

export const updateScenarioCharacterLorebookOverrideSchema = z.object({
  scenarioId: z.string().min(1),
  characterLorebookId: z.string().min(1),
  enabled: z.boolean(),
});

export const linkCharacterLorebookSchema = z.object({
  characterId: z.string().min(1),
  lorebookId: z.string().min(1),
});

export const unlinkCharacterLorebookSchema = linkCharacterLorebookSchema;

export const characterLinkedLorebookSchema = lorebookSummarySchema.extend({
  characterLorebookId: z.string(),
});

export const characterLorebooksResponseSchema = z.object({
  lorebooks: z.array(characterLinkedLorebookSchema),
});

export type LorebookSummary = z.infer<typeof lorebookSummarySchema>;
export type LorebookDetail = z.infer<typeof lorebookDetailSchema>;
export type LorebookSearchQuery = z.infer<typeof lorebookSearchQuerySchema>;
export type AssignScenarioManualLorebookInput = z.infer<typeof assignScenarioManualLorebookSchema>;
export type ScenarioLorebookItem = z.infer<typeof scenarioLorebookItemSchema>;
export type ScenarioLorebookAssignmentInput = z.infer<typeof scenarioLorebookAssignmentInputSchema>;
export type UpdateScenarioManualLorebookStateInput = z.infer<
  typeof updateScenarioManualLorebookStateSchema
>;
export type UpdateScenarioCharacterLorebookOverrideInput = z.infer<
  typeof updateScenarioCharacterLorebookOverrideSchema
>;
export type CharacterLinkedLorebook = z.infer<typeof characterLinkedLorebookSchema>;
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
