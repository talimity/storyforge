import {
  createIntentInputSchema,
  createIntentOutputSchema,
  environmentInputSchema,
  environmentOutputSchema,
  intentProgressInputSchema,
  intentResultInputSchema,
  intentResultOutputSchema,
  loadTimelineInputSchema,
  loadTimelineOutputSchema,
} from "@storyforge/schemas";
import { z } from "zod";
import { getScenarioEnvironment } from "@/library/scenario/scenario.queries";
import { TimelineService } from "@/library/turn/timeline.service";
import { getTimelineWindow } from "@/library/turn/turn.queries";
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
        layers: [{ key: "presentation", content: input.text }],
      });
      return { newTurnId: turn.id };
    }),

  environment: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/play/environment",
        tags: ["play"],
        summary:
          "Returns initial data for setting up the scenario player environment",
      },
    })
    .input(environmentInputSchema)
    .output(environmentOutputSchema)
    .query(async ({ input, ctx }) => {
      const { scenarioId } = input;
      return getScenarioEnvironment(ctx.db, scenarioId);
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
      const { scenarioId, cursor, windowSize /*, layer = "presentation"*/ } =
        input;

      // If there is no anchor/turns yet, return an empty slice
      const scenario = await ctx.db.query.scenarios.findFirst({
        where: { id: scenarioId },
        columns: { anchorTurnId: true },
      });
      if (!scenario) throw new Error(`Scenario ${scenarioId} not found`);

      const targetLeafId = cursor ?? scenario.anchorTurnId;
      if (!targetLeafId) {
        return {
          timeline: [],
          timelineDepth: 0,
          cursors: { nextLeafTurnId: null },
        };
      }

      const rows = await getTimelineWindow(ctx.db, {
        scenarioId,
        leafTurnId: targetLeafId,
        windowSize,
      });

      if (rows.length === 0) {
        return {
          timeline: [],
          timelineDepth: 0,
          cursors: { nextLeafTurnId: null },
        };
      }

      // Build API rows directly from SQL result
      const timeline = rows.map((r) => ({
        id: r.id,
        turnNo: r.turn_no,
        scenarioId: r.scenario_id,
        chapterId: r.chapter_id,
        parentTurnId: r.parent_turn_id,
        authorParticipantId: r.author_participant_id,
        swipes: {
          leftTurnId: r.left_turn_id,
          rightTurnId: r.right_turn_id,
          swipeCount: r.swipe_count,
          swipeNo: Math.max(0, r.swipe_no - 1),
        },
        layer: "presentation" as const,
        content: {
          text: r.content ?? "",
          createdAt: new Date(r.layer_created_at * 1000).toISOString(),
          updatedAt: new Date(r.layer_updated_at * 1000).toISOString(),
        },

        createdAt: new Date(r.created_at * 1000).toISOString(),
        updatedAt: new Date(r.updated_at * 1000).toISOString(),
      }));

      // Cursor-by-ancestor: take TOP row's parent (root-most in this page)
      const hasMoreTurns =
        rows.length === windowSize && rows[0].parent_turn_id !== null;
      const nextLeafTurnId = hasMoreTurns ? rows[0].parent_turn_id : null;

      // All rows carry the same depth scalar; take it from the first
      const timelineDepth = rows[0].timeline_depth;

      return {
        timeline,
        timelineDepth,
        cursors: { nextLeafTurnId },
      };
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
