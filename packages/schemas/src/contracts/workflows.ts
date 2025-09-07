import { genStepSchema, genWorkflowSchema, taskKindSchema } from "@storyforge/gentasks";
import { z } from "zod";

// Basic identifiers
export const workflowIdSchema = z.object({ id: z.string().min(1) });

// Create/Update
export const createWorkflowSchema = z.object({
  task: taskKindSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(genStepSchema).min(1),
});

export const updateWorkflowSchema = z
  .object({
    task: taskKindSchema.optional(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    steps: z.array(genStepSchema).min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided");

// List filters
export const listWorkflowsQuerySchema = z.object({
  task: taskKindSchema.optional(),
  search: z.string().optional(),
});

// Output shapes
export const workflowSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  task: taskKindSchema,
  version: z.number(),
  stepCount: z.number(),
  isBuiltIn: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const workflowDetailSchema = genWorkflowSchema.extend({
  isBuiltIn: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const workflowsListResponseSchema = z.object({
  workflows: z.array(workflowSummarySchema),
});

export const workflowDetailResponseSchema = workflowDetailSchema;
export const workflowOperationResponseSchema = workflowDetailSchema;

// Duplicate
export const duplicateWorkflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
});

// Import/Export (optional for v1, but mirrors templates)
export const importWorkflowSchema = z.object({
  workflow: genWorkflowSchema.omit({ id: true }),
});

export const exportWorkflowResponseSchema = z.object({
  workflow: genWorkflowSchema,
  exportedAt: z.date(),
});

// Scope contracts
export const workflowScopeKindSchema = z.enum(["default", "scenario", "character", "participant"]);

export const upsertWorkflowScopeSchema = z.object({
  workflowId: z.string().min(1),
  // The workflow's task will be derived server-side, but allow explicit task for validation flexibility
  task: taskKindSchema.optional(),
  scopeKind: workflowScopeKindSchema,
  scenarioId: z.string().optional(),
  characterId: z.string().optional(),
  participantId: z.string().optional(),
});

export const deleteWorkflowScopeSchema = z.object({ id: z.string().min(1) });

export const listWorkflowScopesQuerySchema = z.object({
  task: taskKindSchema,
  // optional target filter
  scopeKind: workflowScopeKindSchema.optional(),
  scenarioId: z.string().optional(),
  characterId: z.string().optional(),
  participantId: z.string().optional(),
});

export const workflowScopeRecordSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflowTask: taskKindSchema,
  scopeKind: workflowScopeKindSchema,
  scenarioId: z.string().nullable().optional(),
  characterId: z.string().nullable().optional(),
  participantId: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // convenience: include workflow summary for display
  workflow: workflowSummarySchema.optional(),
});

export const listWorkflowScopesResponseSchema = z.object({
  scopes: z.array(workflowScopeRecordSchema),
});

export type WorkflowSummary = z.infer<typeof workflowSummarySchema>;
export type WorkflowDetail = z.infer<typeof workflowDetailSchema>;
export type ListWorkflowsQuery = z.infer<typeof listWorkflowsQuerySchema>;
export type WorkflowsListResponse = z.infer<typeof workflowsListResponseSchema>;
export type WorkflowDetailResponse = z.infer<typeof workflowDetailResponseSchema>;
export type WorkflowOperationResponse = z.infer<typeof workflowOperationResponseSchema>;
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
export type DuplicateWorkflowInput = z.infer<typeof duplicateWorkflowSchema>;
export type ImportWorkflowInput = z.infer<typeof importWorkflowSchema>;
export type ExportWorkflowResponse = z.infer<typeof exportWorkflowResponseSchema>;
export type UpsertWorkflowScopeInput = z.infer<typeof upsertWorkflowScopeSchema>;
export type DeleteWorkflowScopeInput = z.infer<typeof deleteWorkflowScopeSchema>;
export type ListWorkflowScopesQuery = z.infer<typeof listWorkflowScopesQuerySchema>;
export type ListWorkflowScopesResponse = z.infer<typeof listWorkflowScopesResponseSchema>;
