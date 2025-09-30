import {
  addTurnInputSchema,
  addTurnOutputSchema,
  generationInfoInputSchema,
  generationInfoOutputSchema,
  insertTurnAfterInputSchema,
  insertTurnAfterOutputSchema,
  queryTimelineInputSchema,
  queryTimelineOutputSchema,
  resolveLeafInputSchema,
  resolveLeafOutputSchema,
  switchTimelineInputSchema,
  switchTimelineOutputSchema,
  timelineStateInputSchema,
  timelineStateOutputSchema,
  updateTurnContentInputSchema,
} from "@storyforge/contracts";
import { sqliteTimestampToDate } from "@storyforge/db";
import { z } from "zod";
import { ServiceError } from "../../service-error.js";
import { getGenerationInfoForTurn } from "../../services/intent/debugging/generation-info.queries.js";
import {
  getTimelineWindow,
  resolveLeafForScenario,
} from "../../services/timeline/timeline.queries.js";
import { TimelineService } from "../../services/timeline/timeline.service.js";
import { TimelineStateService } from "../../services/timeline-events/timeline-state.service.js";
import { TurnContentService } from "../../services/turn/turn-content.service.js";
import { publicProcedure, router } from "../index.js";

export const timelineRouter = router({
  window: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/timeline",
        tags: ["timeline"],
        summary: "Returns a slice of the timeline for a scenario",
      },
    })
    .input(queryTimelineInputSchema)
    .output(queryTimelineOutputSchema)
    .query(async ({ input, ctx }) => {
      // TODO: move this to queries module
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
          timelineLength: 0,
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
          timelineLength: 0,
          cursors: { nextCursor: null },
        };
      }

      const timeline = rows.map((r) => ({
        id: r.id,
        turnNo: r.turn_no,
        scenarioId: r.scenario_id,
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
        provenance:
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
        events: r.events,
      }));

      // Cursor-by-ancestor: take TOP row's parent (root-most in this page)
      const hasMoreTurns = rows.length === windowSize && rows[0].parent_turn_id !== null;
      const nextCursor = hasMoreTurns ? rows[0].parent_turn_id : null;

      // Same for all rows returned by the query
      const timelineLength = rows[0].timeline_length;

      return {
        timeline,
        timelineLength,
        cursors: { nextCursor },
      };
    }),

  resolveLeaf: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/timeline/resolve-leaf",
        tags: ["timeline"],
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
        path: "/api/timeline/switch-timeline",
        tags: ["timeline"],
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

  addTurn: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/timeline/turn",
        tags: ["timeline"],
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
        branchFromTurnId: input.parentTurnId,
        layers: [{ key: "presentation", content: input.text }],
      });
      return { turnId: turn.id };
    }),

  insertTurnAfter: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/timeline/turn/insert-after",
        tags: ["timeline"],
        summary: "Insert a new turn after the specified turn and reparent existing children",
      },
    })
    .input(insertTurnAfterInputSchema)
    .output(insertTurnAfterOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const timeline = new TimelineService(ctx.db);
      const turn = await timeline.insertTurnAfter({
        scenarioId: input.scenarioId,
        targetTurnId: input.targetTurnId,
        authorParticipantId: input.authorParticipantId,
        layers: [{ key: "presentation", content: input.text }],
      });
      return { turnId: turn.id };
    }),

  deleteTurn: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/timeline/turn/{turnId}",
        tags: ["timeline"],
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
        path: "/api/timeline/turn/{turnId}/content",
        tags: ["timeline"],
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

  state: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/timeline/state",
        tags: ["timeline"],
        summary: "Returns the derived state of the timeline, optionally for a specific turn",
      },
    })
    .input(timelineStateInputSchema)
    .output(timelineStateOutputSchema)
    .query(async ({ input, ctx }) => {
      const { scenarioId, atTurnId } = input;
      const stateService = new TimelineStateService(ctx.db);
      const derivation = await stateService.deriveState(scenarioId, atTurnId);
      return { state: derivation.final };
    }),

  generationInfo: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/timeline/turn/{turnId}/generation",
        tags: ["timeline", "intents"],
        summary: "Returns generation diagnostics for a turn",
      },
    })
    .input(generationInfoInputSchema)
    .output(generationInfoOutputSchema)
    .query(async ({ input, ctx }) => {
      return getGenerationInfoForTurn(ctx.db, input.turnId);
    }),
});
