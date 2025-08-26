import {
  promptTemplateSchema,
  taskKindSchema,
} from "@storyforge/prompt-renderer";
import { z } from "zod";

// Input schemas
export const templateIdSchema = z.object({ id: z.string().min(1) });

export const createTemplateSchema = promptTemplateSchema.omit({
  id: true,
  version: true,
});

export const updateTemplateSchema = promptTemplateSchema
  .omit({ id: true, version: true })
  .partial();

export const duplicateTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
});

export const importTemplateSchema = z.object({
  template: promptTemplateSchema.omit({ id: true, version: true }),
});

export const listTemplatesQuerySchema = z.object({
  task: taskKindSchema.optional(),
  search: z.string().optional(),
});

// Output schemas
export const templateSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  task: taskKindSchema,
  version: z.number(),
  slotCount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const templateDetailSchema = promptTemplateSchema.extend({
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const templatesListResponseSchema = z.object({
  templates: z.array(templateSummarySchema),
});

export const templateDetailResponseSchema = templateDetailSchema;

export const templateOperationResponseSchema = templateDetailSchema;

export const exportTemplateResponseSchema = z.object({
  template: promptTemplateSchema,
  exportedAt: z.date(),
});

// Export inferred types
export type TemplateSummary = z.infer<typeof templateSummarySchema>;
export type TemplateDetail = z.infer<typeof templateDetailSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type DuplicateTemplateInput = z.infer<typeof duplicateTemplateSchema>;
export type ImportTemplateInput = z.infer<typeof importTemplateSchema>;
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;
export type TemplatesListResponse = z.infer<typeof templatesListResponseSchema>;
export type TemplateDetailResponse = z.infer<
  typeof templateDetailResponseSchema
>;
export type TemplateOperationResponse = z.infer<
  typeof templateOperationResponseSchema
>;
export type ExportTemplateResponse = z.infer<
  typeof exportTemplateResponseSchema
>;
