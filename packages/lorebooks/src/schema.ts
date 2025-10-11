import { createId } from "@storyforge/utils";
import { z } from "zod";

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

export const lorebookDataSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  scan_depth: z.number().int().min(0).optional(),
  token_budget: z.number().int().min(0).optional(),
  recursive_scanning: z.boolean().optional(),
  extensions: z.record(z.string(), z.unknown()).default({}),
  entries: z.array(lorebookEntrySchema),
});

export const activatedLoreEntrySchema = z.object({
  lorebookId: z.string(),
  entryId: z.union([z.string(), z.number()]),
  content: z.string(),
  position: z.union([z.literal("before_char"), z.literal("after_char")]),
  name: z.string().optional(),
  comment: z.string().optional(),
});

export const activatedLoreIndexSchema = z.object({
  before_char: z.array(activatedLoreEntrySchema),
  after_char: z.array(activatedLoreEntrySchema),
});

export const lorebookEntryEvaluationTraceSchema = z.object({
  entryId: z.union([z.string(), z.number()]),
  activated: z.boolean(),
  matchedKeys: z.array(z.string()),
  matchedSecondaryKeys: z.array(z.string()),
  matchKind: z.union([
    z.literal("constant"),
    z.literal("text"),
    z.literal("regex"),
    z.literal("none"),
  ]),
  skippedByBudget: z.boolean(),
  errors: z.array(z.string()),
});

export const lorebookEvaluationTraceSchema = z.object({
  lorebookId: z.string(),
  entries: z.array(lorebookEntryEvaluationTraceSchema),
});

export const lorebookActivationDebugResponseSchema = z.object({
  result: activatedLoreIndexSchema,
  trace: z.array(lorebookEvaluationTraceSchema),
});

export type LorebookEntry = z.infer<typeof lorebookEntrySchema>;
export type LorebookData = z.infer<typeof lorebookDataSchema>;
export type ActivatedLoreEntryContract = z.infer<typeof activatedLoreEntrySchema>;
export type ActivatedLoreIndexContract = z.infer<typeof activatedLoreIndexSchema>;
export type LorebookEntryEvaluationTraceContract = z.infer<
  typeof lorebookEntryEvaluationTraceSchema
>;
export type LorebookEvaluationTraceContract = z.infer<typeof lorebookEvaluationTraceSchema>;
export type LorebookActivationDebugResponse = z.infer<typeof lorebookActivationDebugResponseSchema>;
