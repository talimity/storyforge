import {
  deleteTimelineEventInputSchema,
  deleteTimelineEventOutputSchema,
  insertChapterBreakEventInputSchema,
  insertChapterBreakEventOutputSchema,
  insertParticipantPresenceEventInputSchema,
  insertParticipantPresenceEventOutputSchema,
  insertSceneSetEventInputSchema,
  insertSceneSetEventOutputSchema,
  renameChapterBreakEventInputSchema,
  renameChapterBreakEventOutputSchema,
} from "@storyforge/contracts";
import { TimelineEventsService } from "../../services/timeline-events/timeline-events.service.js";
import { publicProcedure, router } from "../index.js";

export const timelineEventsRouter = router({
  insertChapterBreakEvent: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/timeline/events/chapter-break",
        tags: ["timeline", "timeline-events"],
        summary: "Inserts a chapter break event on the timeline",
      },
    })
    .input(insertChapterBreakEventInputSchema)
    .output(insertChapterBreakEventOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new TimelineEventsService(ctx.db);
      const event = await service.insertChapterBreak({
        scenarioId: input.scenarioId,
        turnId: input.turnId,
        nextChapterTitle: input.nextChapterTitle,
      });
      return { eventId: event.id };
    }),

  insertParticipantPresenceEvent: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/timeline/events/participant-presence",
        tags: ["timeline", "timeline-events"],
        summary: "Inserts a participant presence event on the timeline",
      },
    })
    .input(insertParticipantPresenceEventInputSchema)
    .output(insertParticipantPresenceEventOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new TimelineEventsService(ctx.db);
      const event = await service.insertParticipantPresence(input);
      return { eventId: event.id };
    }),

  insertSceneSetEvent: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/timeline/events/scene-set",
        tags: ["timeline", "timeline-events"],
        summary: "Inserts a scene change event on the timeline",
      },
    })
    .input(insertSceneSetEventInputSchema)
    .output(insertSceneSetEventOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new TimelineEventsService(ctx.db);
      const event = await service.insertSceneSet(input);
      return { eventId: event.id };
    }),

  renameChapter: publicProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/api/timeline/events/chapter-break/{eventId}",
        tags: ["timeline", "timeline-events"],
        summary: "Renames a chapter's title given its event ID",
      },
    })
    .input(renameChapterBreakEventInputSchema)
    .output(renameChapterBreakEventOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new TimelineEventsService(ctx.db);
      const updated = await service.renameChapterBreak({
        scenarioId: input.scenarioId,
        eventId: input.eventId,
        nextChapterTitle: input.nextChapterTitle,
      });
      return { eventId: updated.id, payloadVersion: updated.payloadVersion };
    }),

  deleteTimelineEvent: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/timeline/events/{eventId}",
        tags: ["timeline", "timeline-events"],
        summary: "Removes a timeline event",
      },
    })
    .input(deleteTimelineEventInputSchema)
    .output(deleteTimelineEventOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new TimelineEventsService(ctx.db);
      await service.deleteEvent(input.eventId);
      return { success: true };
    }),
});
