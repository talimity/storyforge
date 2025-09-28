import { z } from "zod";
import { chapterBreakSpec, chaptersConcern } from "./concerns/chapters.js";
import { presenceChangeSpec, presenceConcern } from "./concerns/presence.js";
import { defineConcerns, defineEvents } from "./define.js";
import type { AnyTimelineEventKind } from "./types.js";

export const timelineStateSchema = z.object({
  chapters: chaptersConcern.schema,
  presence: presenceConcern.schema,
});

/**
 * Contains specifications for each concern (slice of timeline state), which
 * provide implementations for reducing events to derive timeline state.
 */
export const timelineConcerns = defineConcerns<TimelineState>()({
  chapters: chaptersConcern,
  presence: presenceConcern,
  // sceneConcern,           // handles 'scene_set'
  // inventoryConcern handles 'inventory_add'/'inventory_remove'
  // secretsConcern handles 'secret_set'/'secret_reveal'
  // goalsConcern handles 'goal_set'/'goal_reach'/'goal_fail'
} as const);

/**
 * Contains specifications for each kind of timeline event.
 */
export const timelineEvents = defineEvents({
  chapter_break: chapterBreakSpec,
  presence_change: presenceChangeSpec,
  // scene_set: sceneSetSpec,
  // inventory_add: inventoryAddSpec, inventory_remove: inventoryRemoveSpec, ...
} as const);

export const timelineEventKindToConcern: Record<AnyTimelineEventKind, keyof TimelineState> = {
  chapter_break: "chapters",
  presence_change: "presence",
};

export type TimelineConcerns = typeof timelineConcerns;
export type TimelineState = z.infer<typeof timelineStateSchema>;
export type TimelineEvents = typeof timelineEvents;
export type TimelineEventPayloadMap = {
  [K in keyof TimelineEvents]: z.infer<TimelineEvents[K]["schema"]>;
};
