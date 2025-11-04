import { z } from "zod";

export const chapterSummarySchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  chapterEventId: z.string(),
  closingEventId: z.string(),
  closingTurnId: z.string().nullable(),
  chapterNumber: z.number().int().positive(),
  title: z.string().nullable(),
  summaryText: z.string(),
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
  "current",
  "ready",
  "stale",
  "running",
  "error",
]);

export const chapterSummaryStatusSchema = z.object({
  chapterEventId: z.string(),
  closingEventId: z.string().optional(),
  closingTurnId: z.string().optional(),
  chapterNumber: z.number().int().positive(),
  title: z.string().optional(),
  state: chapterSummaryStatusStateSchema,
  summaryId: z.string().optional(),
  updatedAt: z.date().optional(),
  turnCount: z.number().int().nonnegative().optional(),
  workflowId: z.string().optional(),
  modelProfileId: z.string().optional(),
  runId: z.string().optional(),
  lastError: z.string().optional(),
  run: z
    .object({
      startedAt: z.date(),
      finishedAt: z.date().optional(),
      elapsedMs: z.number().int().nonnegative(),
      lastEvent: z
        .object({
          type: z.string(),
          stepId: z.string().optional(),
          name: z.string().optional(),
          ts: z.date(),
          delta: z.string().optional(),
        })
        .optional(),
      outputPreview: z.string().optional(),
    })
    .optional(),
  staleReasons: z.array(z.string()).optional(),
});

export const getChapterSummaryStatusInputSchema = z.object({
  scenarioId: z.string(),
  chapterEventId: z.string(),
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

export const saveChapterSummaryInputSchema = z.object({
  scenarioId: z.string(),
  closingEventId: z.string(),
  summaryText: z.string(),
});

export const saveChapterSummaryOutputSchema = z.object({
  summary: chapterSummarySchema.nullable(),
});

export const listChapterSummariesForPathInputSchema = z.object({
  scenarioId: z.string(),
  leafTurnId: z.string().optional(),
});

export const listChapterSummariesForPathOutputSchema = z.object({
  summaries: z.array(chapterSummaryStatusSchema),
});

export type ChapterSummary = z.infer<typeof chapterSummarySchema>;
export type ChapterSummaryStatusState = z.infer<typeof chapterSummaryStatusStateSchema>;
export type ChapterSummaryStatus = z.infer<typeof chapterSummaryStatusSchema>;
export type ChapterSummaryStatusOutput = z.infer<typeof getChapterSummaryStatusOutputSchema>;
export type ChapterSummaryStatusInput = z.infer<typeof getChapterSummaryStatusInputSchema>;
export type ChapterSummaryOutput = z.infer<typeof getChapterSummaryOutputSchema>;
export type ChapterSummaryInput = z.infer<typeof getChapterSummaryInputSchema>;
export type SummarizeChapterInput = z.infer<typeof summarizeChapterInputSchema>;
export type SummarizeChapterOutput = z.infer<typeof summarizeChapterOutputSchema>;
export type BulkSummarizeMissingInput = z.infer<typeof bulkSummarizeMissingInputSchema>;
export type BulkSummarizeMissingOutput = z.infer<typeof bulkSummarizeMissingOutputSchema>;
export type ListChapterSummariesForPathInput = z.infer<
  typeof listChapterSummariesForPathInputSchema
>;
export type ListChapterSummariesForPathOutput = z.infer<
  typeof listChapterSummariesForPathOutputSchema
>;
export type SaveChapterSummaryInput = z.infer<typeof saveChapterSummaryInputSchema>;
export type SaveChapterSummaryOutput = z.infer<typeof saveChapterSummaryOutputSchema>;
