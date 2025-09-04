import { z } from "zod";
import { taskKindSchema } from "../schemas.js";
import type { TaskKind } from "../types.js";
import type { GenStep, GenWorkflow } from "./types.js";

// Transform specification schemas
const trimTransformSchema = z.object({
  applyTo: z.enum(["input", "output"]),
  trim: z.enum(["start", "end", "both"]),
});

const regexTransformSchema = z.object({
  applyTo: z.enum(["input", "output"]),
  regex: z.object({
    pattern: z.string(),
    substitution: z.string(),
    flags: z.string().optional(),
  }),
});

export const transformSpecSchema = z.union([
  trimTransformSchema,
  regexTransformSchema,
]);

// Output capture schemas
const assistantTextCaptureSchema = z.object({
  key: z.string(),
  capture: z.literal("assistantText"),
});

const jsonParsedCaptureSchema = z.object({
  key: z.string(),
  capture: z.literal("jsonParsed"),
  jsonPath: z.string().optional(),
});

export const outputCaptureSchema = z.union([
  assistantTextCaptureSchema,
  jsonParsedCaptureSchema,
]);

// Generation step schema
export const genStepSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  modelProfileId: z.string(),
  promptTemplateId: z.string(),
  genParams: z.record(z.string(), z.any()).optional(),
  stop: z.array(z.string()).default([]),
  maxOutputTokens: z.number().optional(),
  maxContextTokens: z.number().optional(),
  transforms: z.array(transformSpecSchema).optional(),
  outputs: z.array(outputCaptureSchema),
});

// Workflow schema
export const genWorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  task: taskKindSchema,
  version: z.literal(1),
  steps: z.array(genStepSchema).min(1),
});

// Runtime validation helpers
export function validateWorkflow<K extends TaskKind>(
  workflow: GenWorkflow<K>
): GenWorkflow<K> {
  return genWorkflowSchema.parse(workflow) as GenWorkflow<K>;
}

export function validateStep(step: GenStep): GenStep {
  return genStepSchema.parse(step);
}
