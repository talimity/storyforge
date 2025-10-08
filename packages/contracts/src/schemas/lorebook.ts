import { createId } from "@storyforge/utils";
import { z } from "zod";
import { fileDataUriSchema } from "../utils/data-uri-validation.js";

export const lorebookEntrySchema = z.object({
  id: z.union([z.number(), z.string()]).default(() => createId()),
  enabled: z.boolean(),
  constant: z.boolean().optional(),
  comment: z.string().optional(),
  keys: z.array(z.string().min(1, "Keyword cannot be empty")),
  selective: z.boolean().optional(),
  secondary_keys: z.array(z.string().min(1)).optional(),
  content: z.string().min(1, "Content is required"),
  extensions: z.record(z.string(), z.unknown()).default({}),
  insertion_order: z.number().int().min(0),
  case_sensitive: z.boolean().optional(),
  name: z.string().optional(),
  priority: z.number().optional(),
  use_regex: z.boolean().optional(),
  position: z
    .union([z.literal("before_char"), z.literal("after_char"), z.string(), z.number()])
    .optional(),
});

const lorebookSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  scan_depth: z.number().optional(),
  token_budget: z.number().optional(),
  recursive_scanning: z.boolean().optional(),
  extensions: z.record(z.string(), z.unknown()).default({}),
  entries: z.array(lorebookEntrySchema),
});

export const lorebookIdSchema = z.object({
  id: z.string().min(1),
});

export const lorebookDataSchema = lorebookSchema;

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

export type LorebookEntry = z.infer<typeof lorebookEntrySchema>;
export type LorebookData = z.infer<typeof lorebookDataSchema>;
export type LorebookSummary = z.infer<typeof lorebookSummarySchema>;
export type LorebookDetail = z.infer<typeof lorebookDetailSchema>;
export type LorebookSearchQuery = z.infer<typeof lorebookSearchQuerySchema>;
export type AssignLorebookInput = z.infer<typeof assignLorebookSchema>;
export type ReorderScenarioLorebooksInput = z.infer<typeof reorderScenarioLorebooksSchema>;
export type LinkCharacterLorebookInput = z.infer<typeof linkCharacterLorebookSchema>;
export type ImportLorebookFromCharacterInput = z.infer<typeof importLorebookFromCharacterSchema>;
export type ImportLorebookInput = z.infer<typeof importLorebookSchema>;
