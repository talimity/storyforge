import {
  bulkSummarizeMissingInputSchema,
  bulkSummarizeMissingOutputSchema,
  getChapterSummaryInputSchema,
  getChapterSummaryOutputSchema,
  getChapterSummaryStatusInputSchema,
  getChapterSummaryStatusOutputSchema,
  listChapterSummariesForPathInputSchema,
  listChapterSummariesForPathOutputSchema,
  saveChapterSummaryInputSchema,
  saveChapterSummaryOutputSchema,
  summarizeChapterInputSchema,
  summarizeChapterOutputSchema,
} from "@storyforge/contracts";
import { ServiceError } from "../../service-error.js";
import { ChapterSummariesService } from "../../services/chapter-summaries/chapter-summaries.service.js";
import { publicProcedure, router } from "../index.js";

export const chapterSummariesRouter = router({
  get: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/chapter-summaries/{closingEventId}",
        tags: ["chapter_summaries"],
        summary: "Fetch a chapter summary by closing event id",
      },
    })
    .input(getChapterSummaryInputSchema)
    .output(getChapterSummaryOutputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ChapterSummariesService(ctx.db);
      const summary = await service.getSummary(input.closingEventId);
      if (!summary) {
        throw new ServiceError("NotFound", {
          message: `No summary for chapter break ${input.closingEventId}`,
        });
      }
      return { summary };
    }),

  status: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/chapter-summaries/{chapterEventId}/status",
        tags: ["chapter_summaries"],
        summary: "Get status for a chapter summary",
      },
    })
    .input(getChapterSummaryStatusInputSchema)
    .output(getChapterSummaryStatusOutputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ChapterSummariesService(ctx.db);
      const status = await service.getStatus(input);
      return { status };
    }),

  listForPath: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/chapter-summaries",
        tags: ["chapter_summaries"],
        summary: "List chapter summary statuses for a scenario path",
      },
    })
    .input(listChapterSummariesForPathInputSchema)
    .output(listChapterSummariesForPathOutputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ChapterSummariesService(ctx.db);
      const summaries = await service.listForPath(input);
      return { summaries };
    }),

  summarize: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/chapter-summaries",
        tags: ["chapter_summaries"],
        summary: "Start or reuse a chapter summarization run",
      },
    })
    .input(summarizeChapterInputSchema)
    .output(summarizeChapterOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ChapterSummariesService(ctx.db);
      const { runId } = await service.summarizeChapter(input);
      return { runId };
    }),

  save: publicProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/api/chapter-summaries/{closingEventId}",
        tags: ["chapter_summaries"],
        summary: "Save manual edits to a chapter summary",
      },
    })
    .input(saveChapterSummaryInputSchema)
    .output(saveChapterSummaryOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ChapterSummariesService(ctx.db);
      const summary = await service.saveSummary(input);
      return { summary };
    }),

  bulkSummarizeMissing: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/chapter-summaries/bulk",
        tags: ["chapter_summaries"],
        summary: "Enqueue summarization for missing or stale chapters on a path",
      },
    })
    .input(bulkSummarizeMissingInputSchema)
    .output(bulkSummarizeMissingOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ChapterSummariesService(ctx.db);
      const { enqueued, runIds } = await service.bulkSummarizeMissing(input);
      return { enqueued, runIds };
    }),
});
