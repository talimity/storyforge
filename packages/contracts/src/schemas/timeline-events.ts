import { chapterBreakSpec, presenceChangeSpec } from "@storyforge/timeline-events";
import { z } from "zod";

export const timelineEventPositionSchema = z
  .enum(["before", "after"])
  .describe("Position of the event relative to the associated turn.");

// TODO: remove
export const sceneSetTimelineEventPayloadSchema = z.object({
  sceneName: z.string(),
  description: z.string().nullable(),
});

export const timelineEventKindSchema = z.enum(["chapter_break", "scene_set", "presence_change"]);

export const timelineEventSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    turnId: z.string(),
    position: timelineEventPositionSchema,
    orderKey: z.string(),
    payloadVersion: z.number().int().min(1),
    kind: z.literal("chapter_break"),
    payload: chapterBreakSpec.schema,
  }),
  z.object({
    id: z.string(),
    turnId: z.string(),
    position: timelineEventPositionSchema,
    orderKey: z.string(),
    payloadVersion: z.number().int().min(1),
    kind: z.literal("scene_set"),
    payload: sceneSetTimelineEventPayloadSchema,
  }),
  z.object({
    id: z.string(),
    turnId: z.string(),
    position: timelineEventPositionSchema,
    orderKey: z.string(),
    payloadVersion: z.number().int().min(1),
    kind: z.literal("presence_change"),
    payload: presenceChangeSpec.schema,
  }),
]);

export type TimelineEventKind = z.infer<typeof timelineEventKindSchema>;
export type TimelineEventPosition = z.infer<typeof timelineEventPositionSchema>;
export type TimelineEvent = z.infer<typeof timelineEventSchema>;
