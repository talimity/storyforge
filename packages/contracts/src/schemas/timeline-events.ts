import { chapterBreakSpec, presenceChangeSpec } from "@storyforge/timeline-events";
import { z } from "zod";

// TODO: remove
export const sceneSetTimelineEventPayloadSchema = z.object({
  sceneName: z.string(),
  description: z.string().nullable(),
});

export const timelineEventKindSchema = z.enum(["chapter_break", "scene_set", "presence_change"]);

export const timelineEventSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    orderKey: z.string(),
    payloadVersion: z.number().int().min(1),
    kind: z.literal("chapter_break"),
    payload: chapterBreakSpec.schema,
    prompt: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    orderKey: z.string(),
    payloadVersion: z.number().int().min(1),
    kind: z.literal("scene_set"),
    payload: sceneSetTimelineEventPayloadSchema,
    prompt: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    orderKey: z.string(),
    payloadVersion: z.number().int().min(1),
    kind: z.literal("presence_change"),
    payload: presenceChangeSpec.schema,
    prompt: z.string().optional(),
  }),
]);

// TODO: WIP events API
export const insertChapterBreakEventInputSchema = z.object({
  scenarioId: z.string(),
  turnId: z.string(),
  nextChapterTitle: z.string(),
});
export const insertChapterBreakEventOutputSchema = z.object({ eventId: z.string() });

export const insertParticipantPresenceEventInputSchema = z.object({
  scenarioId: z.string(),
  turnId: z.string(),
  participantId: z.string(),
  active: z.boolean(),
  status: z.string().nullable().optional(),
});
export const insertParticipantPresenceEventOutputSchema = z.object({ eventId: z.string() });

export const insertSceneSetEventInputSchema = z.object({
  scenarioId: z.string(),
  turnId: z.string(),
  sceneName: z.string(),
  description: z.string().nullable().optional(),
});
export const insertSceneSetEventOutputSchema = z.object({ eventId: z.string() });

export const deleteTimelineEventInputSchema = z.object({ eventId: z.string() });
export const deleteTimelineEventOutputSchema = z.object({ success: z.boolean() });

export type TimelineEventKind = z.infer<typeof timelineEventKindSchema>;
export type TimelineEvent = z.infer<typeof timelineEventSchema>;
export type InsertChapterBreakEventInput = z.infer<typeof insertChapterBreakEventInputSchema>;
export type InsertChapterBreakEventOutput = z.infer<typeof insertChapterBreakEventOutputSchema>;
export type DeleteTimelineEventInput = z.infer<typeof deleteTimelineEventInputSchema>;
export type DeleteTimelineEventOutput = z.infer<typeof deleteTimelineEventOutputSchema>;
export type InsertParticipantPresenceEventInput = z.infer<
  typeof insertParticipantPresenceEventInputSchema
>;
export type InsertParticipantPresenceEventOutput = z.infer<
  typeof insertParticipantPresenceEventOutputSchema
>;
