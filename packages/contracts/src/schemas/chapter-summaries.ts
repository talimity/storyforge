import { z } from "zod";

export const chapterSummaryRangeSchema = z.object({
  startChapterNumber: z.number().int().positive(),
  endChapterNumber: z.number().int().positive(),
});

export const chapterSummarySchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  closingEventId: z.string(),
  closingTurnId: z.string(),
  chapterNumber: z.number().int().positive(),
  range: chapterSummaryRangeSchema,
  title: z.string().nullable(),
  summaryText: z.string(),
  summaryJson: z.unknown().nullable(),
  turnCount: z.number().int().nonnegative(),
  maxTurnUpdatedAt: z.date(),
  spanFingerprint: z.string(),
  workflowId: z.string().nullable(),
  modelProfileId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const getChapterSummaryInputSchema = z.object({
  closingEventId: z.string(),
});

export const getChapterSummaryOutputSchema = z.object({
  summary: chapterSummarySchema,
});

export const chapterSummaryStatusStateSchema = z.enum([
  "missing",
  "ready",
  "stale",
  "running",
  "error",
]);

export const chapterSummaryStatusSchema = z.object({
  closingEventId: z.string(),
  closingTurnId: z.string(),
  chapterNumber: z.number().int().positive(),
  range: chapterSummaryRangeSchema,
  title: z.string().nullable(),
  state: chapterSummaryStatusStateSchema,
  summaryId: z.string().nullable(),
  updatedAt: z.date().nullable(),
  turnCount: z.number().int().nonnegative().nullable(),
  workflowId: z.string().nullable(),
  modelProfileId: z.string().nullable(),
  runId: z.string().nullable(),
  lastError: z.string().nullable(),
  staleReasons: z.array(z.string()).optional(),
});

export const getChapterSummaryStatusInputSchema = z.object({
  scenarioId: z.string(),
  closingEventId: z.string(),
});

export const getChapterSummaryStatusOutputSchema = z.object({
  status: chapterSummaryStatusSchema,
});

export const summarizeChapterInputSchema = z.object({
  scenarioId: z.string(),
  closingEventId: z.string(),
  force: z.boolean().optional(),
});

export const summarizeChapterOutputSchema = z.object({
  runId: z.string(),
});

export const bulkSummarizeMissingInputSchema = z.object({
  scenarioId: z.string(),
  leafTurnId: z.string().optional(),
  force: z.boolean().optional(),
});

export const bulkSummarizeMissingOutputSchema = z.object({
  enqueued: z.number().int().nonnegative(),
  runIds: z.array(z.string()),
});

export const listChapterSummariesForPathInputSchema = z.object({
  scenarioId: z.string(),
  leafTurnId: z.string().optional(),
});

export const listChapterSummariesForPathOutputSchema = z.object({
  summaries: z.array(chapterSummaryStatusSchema),
});
