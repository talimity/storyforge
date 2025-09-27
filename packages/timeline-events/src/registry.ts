import {
  type ChapterBreakEvent,
  type ChaptersState,
  chapterBreakSpec,
  chaptersConcern,
} from "./concerns/chapters.js";
import {
  type PresenceChangeEvent,
  type PresenceState,
  presenceChangeSpec,
  presenceConcern,
} from "./concerns/presence.js";
import { defineConcerns, defineEvents } from "./define.js";
import type { AnyTimelineEventKind } from "./types.js";

export interface TimelineEventPayloadMap {
  chapter_break: ChapterBreakEvent;
  presence_change: PresenceChangeEvent;
  // "scene_set": SceneSetEvent;
  // future: "inventory_add": InventoryAdd, "inventory_remove": InventoryRemove, ...
}

export type TimelineFinalState = {
  chapters: ChaptersState;
  presence: PresenceState;
  // scene: SceneState;
  // inventory: InventoryState;
};

/**
 * Contains specifications for each concern (slice of timeline state), which
 * provide implementations for reducing events to derive timeline state.
 */
export const timelineConcerns = defineConcerns<TimelineFinalState>()({
  chapters: chaptersConcern,
  presence: presenceConcern,
  // sceneConcern,           // handles 'scene_set'
  // inventoryConcern handles 'inventory_add'/'inventory_remove'
  // secretsConcern handles 'secret_set'/'secret_reveal'
  // goalsConcern handles 'goal_set'/'goal_reach'/'goal_fail'
} as const);
export type TimelineConcerns = typeof timelineConcerns;

/**
 * Contains specifications for each kind of timeline event.
 */
export const timelineEvents = defineEvents({
  chapter_break: chapterBreakSpec,
  presence_change: presenceChangeSpec,
  // scene_set: sceneSetSpec,
  // inventory_add: inventoryAddSpec, inventory_remove: inventoryRemoveSpec, ...
} as const);
export type TimelineEvents = typeof timelineEvents;

export const timelineEventKindToConcern: Record<AnyTimelineEventKind, keyof TimelineFinalState> = {
  chapter_break: "chapters",
  presence_change: "presence",
};
