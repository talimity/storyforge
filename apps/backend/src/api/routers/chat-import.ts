import {
  chatImportAnalyzeInputSchema,
  chatImportAnalyzeOutputSchema,
  chatImportExecuteInputSchema,
  chatImportExecuteOutputSchema,
} from "@storyforge/schemas";
import { publicProcedure, router } from "@/api/index";
import { ChatImportService } from "@/services/chat-import/chat-import.service";
import { ScenarioService } from "@/services/scenario/scenario.service";
import { TimelineService } from "@/services/timeline/timeline.service";

export const chatImportRouter = router({
  analyzeChat: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/chat-import/analyze",
        tags: ["chat-import"],
        summary:
          "Scans a SillyTavern chat export for messages and possible character matches",
      },
    })
    .input(chatImportAnalyzeInputSchema)
    .output(chatImportAnalyzeOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const scenarioService = new ScenarioService(ctx.db);
      const timelineService = new TimelineService(ctx.db);
      const importService = new ChatImportService(
        ctx.db,
        scenarioService,
        timelineService
      );

      return await importService.analyzeChat(input.fileDataUri);
    }),

  importChat: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/chat-import/import",
        tags: ["chat-import"],
        summary:
          "Imports a SillyTavern chat export as a new scenario, using provided character mappings",
      },
    })
    .input(chatImportExecuteInputSchema)
    .output(chatImportExecuteOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const scenarioService = new ScenarioService(ctx.db);
      const timelineService = new TimelineService(ctx.db);
      const importService = new ChatImportService(
        ctx.db,
        scenarioService,
        timelineService
      );

      const result = await importService.importChatAsScenario(input);

      return {
        success: true,
        scenarioId: result.scenarioId,
        turnCount: result.turnCount,
      };
    }),
});
