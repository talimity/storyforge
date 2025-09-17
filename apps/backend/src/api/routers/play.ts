import {
  addTurnInputSchema,
  addTurnOutputSchema,
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
  resolveLeafInputSchema,
  resolveLeafOutputSchema,
  switchTimelineInputSchema,
  switchTimelineOutputSchema,
  updateTurnContentInputSchema,
} from "@storyforge/contracts";
import { sqliteTimestampToDate } from "@storyforge/db";
import { z } from "zod";
import { ServiceError } from "../../service-error.js";
import { getGeneratingIntent } from "../../services/intent/intent.queries.js";
import { IntentService } from "../../services/intent/intent.service.js";
import { intentRunManager } from "../../services/intent/run-manager.js";
import { getScenarioEnvironment } from "../../services/scenario/scenario.queries.js";
import {
  getTimelineWindow,
  resolveLeafForScenario,
} from "../../services/timeline/timeline.queries.js";
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
      const generatingIntent = await getGeneratingIntent(ctx.db, scenarioId);
      return { ...env, generatingIntent };
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
      // TODO: move this to service
      const { scenarioId, cursor, timelineLeafTurnId, windowSize /*, layer = "presentation"*/ } =
        input;

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

      const cursorTurnId = cursor ?? scenario.anchorTurnId;
      if (!cursorTurnId) {
        return {
          timeline: [],
          timelineDepth: 0,
          cursors: { nextCursor: null },
        };
      }

      let leafTurnId: string | undefined;
      if (timelineLeafTurnId) {
        // Ensure the specified leaf is actually a leaf
        leafTurnId = await resolveLeafForScenario(ctx.db, {
          scenarioId,
          fromTurnId: timelineLeafTurnId,
        });
      }

      const rows = await getTimelineWindow(ctx.db, {
        scenarioId,
        cursorTurnId,
        windowSize,
        leafTurnId,
      });

      if (rows.length === 0) {
        return {
          timeline: [],
          timelineDepth: 0,
          cursors: { nextCursor: null },
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
          swipeNo: r.swipe_no,
        },
        layer: "presentation" as const,
        content: {
          text: r.content ?? "",
          createdAt: sqliteTimestampToDate(r.layer_created_at),
          updatedAt: sqliteTimestampToDate(r.layer_updated_at),
        },

        createdAt: sqliteTimestampToDate(r.created_at),
        updatedAt: sqliteTimestampToDate(r.updated_at),
        intentProvenance:
          r.intent_id && r.intent_kind && r.intent_status
            ? {
                intentId: r.intent_id,
                intentKind: r.intent_kind,
                intentStatus: r.intent_status,
                effectSequence: r.intent_sequence ?? 0,
                effectCount: r.intent_effect_count ?? 0,
                inputText: r.intent_input_text,
                targetParticipantId: r.intent_target_participant_id,
              }
            : null,
      }));

      // Cursor-by-ancestor: take TOP row's parent (root-most in this page)
      const hasMoreTurns = rows.length === windowSize && rows[0].parent_turn_id !== null;
      const nextCursor = hasMoreTurns ? rows[0].parent_turn_id : null;

      // All rows carry the same depth scalar; take it from the first
      const timelineDepth = rows[0].timeline_depth;

      return {
        timeline,
        timelineDepth,
        cursors: { nextCursor },
      };
    }),

  resolveLeaf: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/play/resolve-leaf",
        tags: ["play"],
        summary: "Resolve deepest leaf from a turn (left-most path)",
      },
    })
    .input(resolveLeafInputSchema)
    .output(resolveLeafOutputSchema)
    .mutation(async ({ input, ctx }) => {
      return { leafTurnId: await resolveLeafForScenario(ctx.db, input) };
    }),

  switchTimeline: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/play/switch-timeline",
        tags: ["play"],
        summary: "Switch active timeline anchor to the given branch leaf",
      },
    })
    .input(switchTimelineInputSchema)
    .output(switchTimelineOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const { scenarioId, leafTurnId } = input;
      const timeline = new TimelineService(ctx.db);
      const newAnchorTurnId = await timeline.switchAnchor({ scenarioId, fromTurnId: leafTurnId });
      return { success: true, newAnchorTurnId };
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
        branchFrom: input.branchFrom,
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
        kind: intent.kind,
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
    .input(addTurnInputSchema)
    .output(addTurnOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const turnGraph = new TimelineService(ctx.db);
      const turn = await turnGraph.advanceTurn({
        scenarioId: input.scenarioId,
        authorParticipantId: input.authorParticipantId,
        layers: [{ key: "presentation", content: input.text }],
      });
      return { turnId: turn.id };
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
    .input(updateTurnContentInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { turnId, layer, content } = input;
      const contentService = new TurnContentService(ctx.db);
      await contentService.updateTurnContent({ turnId, layer, content });
      return { success: true };
    }),
});
