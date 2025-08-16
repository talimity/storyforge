import {
  bootstrapInputSchema,
  bootstrapOutputSchema,
  createIntentInputSchema,
  createIntentOutputSchema,
  intentProgressInputSchema,
  intentResultInputSchema,
  intentResultOutputSchema,
  loadTimelineInputSchema,
  loadTimelineOutputSchema,
} from "@storyforge/schemas";
import { z } from "zod";
import { getScenarioBootstrap } from "@/library/scenario/scenario.queries";
import { TimelineService } from "@/library/turn/timeline.service";
import { publicProcedure, router } from "../index";

export const playRouter = router({
  /**
   * Adds a turn with the given text to the scenario, attributed to the
   * specified participant.
   */
  _debugAddNodeToGraph: publicProcedure
    .input(
      z.object({
        scenarioId: z.string(),
        text: z.string(),
        authorParticipantId: z.string(),
        chapterId: z.string(),
        parentTurnId: z.string().optional(),
      })
    )
    .output(z.object({ newTurnId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const turnGraph = new TimelineService(ctx.db);
      const turn = await turnGraph.advanceTurn({
        scenarioId: input.scenarioId,
        authorParticipantId: input.authorParticipantId,
        chapterId: input.chapterId,
        parentTurnId: input.parentTurnId ?? null,
      });
      return { newTurnId: turn.id };
    }),

  bootstrap: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/play/bootstrap",
        tags: ["play"],
        summary:
          "Returns initial data for setting up the scenario player environment",
      },
    })
    .input(bootstrapInputSchema)
    .output(bootstrapOutputSchema)
    .query(async ({ input, ctx }) => {
      const { scenarioId } = input;
      return getScenarioBootstrap(ctx.db, scenarioId);
    }),
  timeline: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/play/timeline",
        tags: ["play"],
        summary: "Returns a slice of the timeline for a scenario",
      },
    })
    .input(loadTimelineInputSchema)
    .output(loadTimelineOutputSchema)
    .query(async ({ input, ctx }) => {
      // biome-ignore lint/suspicious/noExplicitAny: todo
      return {} as any;
    }),
  createIntent: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/play/intent",
        tags: ["play"],
        summary: "Create a new intent to influence the story",
      },
    })
    .input(createIntentInputSchema)
    .output(createIntentOutputSchema)
    .mutation(async ({ input, ctx }) => {
      // biome-ignore lint/suspicious/noExplicitAny: todo
      return {} as any;
    }),
  intentProgress: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/play/intent/{intentId}/subscribe",
        tags: ["play"],
        summary: "Subscribe to updates on a pending intent's progress",
        enabled: false, // tRPC OpenAPI plugin doesn't support subscriptions
      },
    })
    .input(intentProgressInputSchema)
    .subscription(async function* ({ input, ctx }) {
      yield;
      // biome-ignore lint/suspicious/noExplicitAny: todo
      return {} as any;
    }),
  intentResult: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/play/intent/{intentId}",
        tags: ["play"],
        summary: "Get the status and results of an intent",
      },
    })
    .input(intentResultInputSchema)
    .output(intentResultOutputSchema)
    .query(async ({ input, ctx }) => {
      // biome-ignore lint/suspicious/noExplicitAny: todo
      return {} as any;
    }),
});
