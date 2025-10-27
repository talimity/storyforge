import {
  bulkSummarizeMissingInputSchema,
  bulkSummarizeMissingOutputSchema,
  getChapterSummaryInputSchema,
  getChapterSummaryOutputSchema,
  getChapterSummaryStatusInputSchema,
  getChapterSummaryStatusOutputSchema,
  listChapterSummariesForPathInputSchema,
  listChapterSummariesForPathOutputSchema,
  summarizeChapterInputSchema,
  summarizeChapterOutputSchema,
} from "@storyforge/contracts";
import { ServiceError } from "../../service-error.js";
import { ChapterSummariesService } from "../../services/chapter-summaries/chapter-summaries.service.js";
import type { ChapterSummaryRecord } from "../../services/chapter-summaries/types.js";
import { publicProcedure, router } from "../index.js";

const toContractSummary = (summary: ChapterSummaryRecord) => {
  let jsonValue: unknown = summary.summaryJson;
  if (typeof jsonValue === "string") {
    try {
      jsonValue = JSON.parse(jsonValue);
    } catch {
      // keep original string if parsing fails
    }
  }
  return {
    id: summary.id,
    scenarioId: summary.scenarioId,
    closingEventId: summary.closingEventId,
    closingTurnId: summary.closingTurnId,
    chapterNumber: summary.chapterNumber,
    range: {
      startChapterNumber: summary.rangeStartChapterNumber,
      endChapterNumber: summary.rangeEndChapterNumber,
    },
    title: summary.title,
    summaryText: summary.summaryText,
    summaryJson: jsonValue ?? null,
    turnCount: summary.turnCount,
    maxTurnUpdatedAt: summary.maxTurnUpdatedAt,
    spanFingerprint: summary.spanFingerprint,
    workflowId: summary.workflowId ?? null,
    modelProfileId: summary.modelProfileId ?? null,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
  };
};

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
      return { summary: toContractSummary(summary) };
    }),

  status: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/chapter-summaries/{closingEventId}/status",
        tags: ["chapter_summaries"],
        summary: "Get status for a chapter summary",
      },
    })
    .input(getChapterSummaryStatusInputSchema)
    .output(getChapterSummaryStatusOutputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ChapterSummariesService(ctx.db);
      const status = await service.getStatus({
        scenarioId: input.scenarioId,
        closingEventId: input.closingEventId,
      });
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
      const summaries = await service.listForPath({
        scenarioId: input.scenarioId,
        leafTurnId: input.leafTurnId ?? null,
      });
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
      const { runId } = await service.summarizeChapter({
        scenarioId: input.scenarioId,
        closingEventId: input.closingEventId,
        force: input.force ?? false,
      });
      return { runId };
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
      const { enqueued, runIds } = await service.bulkSummarizeMissing({
        scenarioId: input.scenarioId,
        leafTurnId: input.leafTurnId ?? null,
        force: input.force ?? false,
      });
      return { enqueued, runIds };
    }),
});
