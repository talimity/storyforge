import {
  createIntentInputSchema,
  createIntentOutputSchema,
  environmentInputSchema,
  environmentOutputSchema,
  intentInterruptInputSchema,
  intentInterruptOutputSchema,
  intentProgressInputSchema,
  intentResultInputSchema,
  intentResultOutputSchema,
  loadTimelineInputSchema,
  loadTimelineOutputSchema,
} from "@storyforge/contracts";
import { sqliteTimestampToDate } from "@storyforge/db";
import { z } from "zod";
import { ServiceError } from "../../service-error.js";
import { IntentService } from "../../services/intent/intent.service.js";
import { intentRunManager } from "../../services/intent/run-manager.js";
import { getScenarioEnvironment } from "../../services/scenario/scenario.queries.js";
import { getTimelineWindow } from "../../services/timeline/timeline.queries.js";
import { TimelineService } from "../../services/timeline/timeline.service.js";
import { TurnContentService } from "../../services/turn/turn-content.service.js";
import { WorkflowRunnerManager } from "../../services/workflows/workflow-runner-manager.js";
import { publicProcedure, router } from "../index.js";

export const playRouter = router({
  environment: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/play/environment",
        tags: ["play"],
        summary: "Returns initial data for setting up the scenario player environment",
      },
    })
    .input(environmentInputSchema)
    .output(environmentOutputSchema)
    .query(async ({ input, ctx }) => {
      const { scenarioId } = input;
      const env = await getScenarioEnvironment(ctx.db, scenarioId);
      return {
        ...env,
        generatingIntent: null,
      };
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
      const { scenarioId, cursor, windowSize /*, layer = "presentation"*/ } = input;

      // If there is no anchor/turns yet, return an empty slice
      const scenario = await ctx.db.query.scenarios.findFirst({
        where: { id: scenarioId },
        columns: { anchorTurnId: true },
      });

      if (!scenario) {
        throw new ServiceError("NotFound", {
          message: `Scenario with ID ${scenarioId} not found.`,
        });
      }

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
          createdAt: sqliteTimestampToDate(r.layer_created_at),
          updatedAt: sqliteTimestampToDate(r.layer_updated_at),
        },

        createdAt: sqliteTimestampToDate(r.created_at),
        updatedAt: sqliteTimestampToDate(r.updated_at),
      }));

      // Cursor-by-ancestor: take TOP row's parent (root-most in this page)
      const hasMoreTurns = rows.length === windowSize && rows[0].parent_turn_id !== null;
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
        summary: "Creates a new intent to influence the story",
      },
    })
    .input(createIntentInputSchema)
    .output(createIntentOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const timeline = new TimelineService(ctx.db);
      const runnerManager = WorkflowRunnerManager.getInstance(ctx.db);
      const runner = runnerManager.getRunner("turn_generation");
      const service = new IntentService(ctx.db, timeline, runner);
      const result = await service.createAndStart({
        scenarioId: input.scenarioId,
        ...input.parameters,
      });
      return { intentId: result.id };
    }),

  intentProgress: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/play/intent/{intentId}/subscribe",
        tags: ["play"],
        summary: "Subscribes to updates on a pending intent's progress",
        enabled: false, // tRPC OpenAPI plugin doesn't support subscriptions
      },
    })
    .input(intentProgressInputSchema)
    .subscription(async function* ({ input, ctx }) {
      const { intentId } = input;
      // todo: move to service

      const intent = await ctx.db.query.intents.findFirst({
        where: { id: intentId },
        columns: { id: true },
      });
      if (!intent) {
        throw new ServiceError("NotFound", {
          message: `Intent with ID ${intentId} not found.`,
        });
      }

      if (!intentRunManager) {
        throw new ServiceError("InternalError", {
          message: "Intent run manager is not initialized.",
        });
      }

      const run = intentRunManager.get(intentId);
      if (!run) {
        throw new ServiceError("NotFound", {
          message: `No active run for intent ${intentId}.`,
        });
      }

      for await (const ev of run.events()) {
        yield ev;
      }
    }),

  intentResult: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/play/intent/{intentId}",
        tags: ["play"],
        summary: "Gets the status and results of an intent",
      },
    })
    .input(intentResultInputSchema)
    .output(intentResultOutputSchema)
    .query(async ({ input, ctx }) => {
      const { intentId } = input;
      // todo: move to service
      const intent = await ctx.db.query.intents.findFirst({
        where: { id: intentId },
      });
      if (!intent) {
        throw new ServiceError("NotFound", {
          message: `Intent with ID ${intentId} not found.`,
        });
      }

      const scenario = await ctx.db.query.scenarios.findFirst({
        where: { id: intent.scenarioId },
        columns: { anchorTurnId: true },
      });
      if (!scenario) {
        throw new ServiceError("NotFound", {
          message: `Scenario ${intent.scenarioId} not found.`,
        });
      }

      const effects = await ctx.db.query.intentEffects.findMany({
        where: { intentId },
        columns: {
          intentId: true,
          turnId: true,
          sequence: true,
          kind: true,
          createdAt: true,
        },
        orderBy: (t, { asc }) => [asc(t.createdAt)],
      });

      return {
        id: intent.id,
        scenarioId: intent.scenarioId,
        status: intent.status,
        effects,
        // Schema expects non-null string; in practice scenarios will have an anchor by the time
        // results are fetched. Fall back to empty string to satisfy schema.
        anchorTurnId: scenario.anchorTurnId ?? "",
      };
    }),

  interruptIntent: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/play/intent/{intentId}/interrupt",
        tags: ["play"],
        summary: "Cancels a running intent",
        enabled: true,
      },
    })
    .input(intentInterruptInputSchema)
    .output(intentInterruptOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const { intentId } = input;
      // todo: move to service
      const intent = await ctx.db.query.intents.findFirst({
        where: { id: intentId },
      });
      if (!intent) {
        throw new ServiceError("NotFound", {
          message: `Intent with ID ${intentId} not found.`,
        });
      }
      if (!intentRunManager) {
        throw new ServiceError("InternalError", {
          message: "Intent run manager is not initialized.",
        });
      }
      const run = intentRunManager.get(intentId);
      if (!run) {
        throw new ServiceError("NotFound", {
          message: `No active run for intent ${intentId}.`,
        });
      }
      run.cancel();
      return { success: true };
    }),

  addTurn: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/play/turn",
        tags: ["play"],
        summary:
          "Creates a new turn in the scenario without triggering a generation workflow or creating an intent.",
      },
    })
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

  deleteTurn: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/play/turn/{turnId}",
        tags: ["play"],
        summary: "Deletes a turn from the scenario",
      },
    })
    .input(
      z.object({
        turnId: z.string(),
        cascade: z.boolean().default(false).describe("Whether to delete all descendant turns"),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const timelineService = new TimelineService(ctx.db);
      await timelineService.deleteTurn(input.turnId, input.cascade);
      return { success: true };
    }),

  updateTurnContent: publicProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/api/play/turn/{turnId}/content",
        tags: ["play"],
        summary: "Updates a turn's content by layer",
      },
    })
    .input(
      z.object({
        turnId: z.string(),
        layer: z.string().default("presentation"),
        content: z.string(),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { turnId, layer, content } = input;
      const contentService = new TurnContentService(ctx.db);
      await contentService.updateTurnContent({ turnId, layer, content });
      return { success: true };
    }),
});
