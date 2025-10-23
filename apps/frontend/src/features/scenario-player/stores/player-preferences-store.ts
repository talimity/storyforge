import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export const FONT_SIZE_OPTIONS = ["sm", "md", "lg", "xl", "2xl"] as const;
export type FontSizeOption = (typeof FONT_SIZE_OPTIONS)[number];

export const TIMELINE_WIDTH_OPTIONS = ["sm", "md", "lg", "xl", "2xl", "max"] as const;
export type TimelineWidthOption = (typeof TIMELINE_WIDTH_OPTIONS)[number];

export const PREF_WIDTH_TO_TOKEN: Record<TimelineWidthOption, string> = {
  sm: "xl",
  md: "2xl",
  lg: "3xl",
  xl: "4xl",
  "2xl": "5xl",
  max: "full",
};

export function isFontSizeOption(value: string): value is FontSizeOption {
  for (const option of FONT_SIZE_OPTIONS) {
    if (option === value) return true;
  }
  return false;
}

export function isTimelineWidthOption(value: string): value is TimelineWidthOption {
  for (const option of TIMELINE_WIDTH_OPTIONS) {
    if (option === value) return true;
  }
  return false;
}

export const PINNABLE_TURN_ACTIONS = ["edit", "retry", "delete", "generation-info"] as const;

export type PinnableTurnAction = (typeof PINNABLE_TURN_ACTIONS)[number];

export function isPinnableTurnAction(value: string): value is PinnableTurnAction {
  for (const option of PINNABLE_TURN_ACTIONS) {
    if (option === value) return true;
  }
  return false;
}

export interface PlayerPreferencesState {
  fontSize: FontSizeOption;
  timelineWidth: TimelineWidthOption;
  pinnedQuickActions: PinnableTurnAction[];
  setFontSize: (value: FontSizeOption) => void;
  setTimelineWidth: (value: TimelineWidthOption) => void;
  setPinnedQuickActions: (value: PinnableTurnAction[]) => void;
  togglePinnedQuickAction: (actionId: PinnableTurnAction, pinned: boolean) => void;
}

const storage =
  typeof window === "undefined" ? undefined : createJSONStorage(() => window.localStorage);

export const usePlayerPreferencesStore = create<PlayerPreferencesState>()(
  persist(
    immer((set) => ({
      fontSize: "md",
      timelineWidth: "lg",
      pinnedQuickActions: ["edit", "retry"],
      setFontSize: (value) =>
        set((state) => {
          state.fontSize = value;
        }),
      setTimelineWidth: (value) =>
        set((state) => {
          state.timelineWidth = value;
        }),
      setPinnedQuickActions: (value) =>
        set((state) => {
          const unique = new Set<PinnableTurnAction>(value);
          state.pinnedQuickActions = PINNABLE_TURN_ACTIONS.filter((option) => unique.has(option));
        }),
      togglePinnedQuickAction: (actionId, pinned) =>
        set((state) => {
          const next = new Set<PinnableTurnAction>(state.pinnedQuickActions);
          if (pinned) {
            next.add(actionId);
          } else {
            next.delete(actionId);
          }
          state.pinnedQuickActions = PINNABLE_TURN_ACTIONS.filter((option) => next.has(option));
        }),
    })),
    {
      name: "storyforge:scenario-player-preferences",
      storage,
      version: 1,
      partialize: (state) => ({
        fontSize: state.fontSize,
        timelineWidth: state.timelineWidth,
        pinnedQuickActions: state.pinnedQuickActions,
      }),
    }
  )
);

export const selectFontSize = (state: PlayerPreferencesState) => state.fontSize;
export const selectTimelineWidth = (state: PlayerPreferencesState) => state.timelineWidth;
export const selectSetFontSize = (state: PlayerPreferencesState) => state.setFontSize;
export const selectSetTimelineWidth = (state: PlayerPreferencesState) => state.setTimelineWidth;
export const selectPinnedQuickActions = (state: PlayerPreferencesState) => state.pinnedQuickActions;
export const selectTogglePinnedQuickAction = (state: PlayerPreferencesState) =>
  state.togglePinnedQuickAction;
