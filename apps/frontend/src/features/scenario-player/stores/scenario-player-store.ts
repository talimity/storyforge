import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type TimelineScrollTarget =
  | { kind: "bottom" }
  | { kind: "turn"; turnId: string; edge?: "start" | "center" | "end" };

export interface ScenarioPlayerState {
  /** Character selected in the sidebar, the target for new intents */
  selectedCharacterId: string | null;
  /** ID of the leaf turn we are previewing an alternate timeline, or null when not previewing */
  previewLeafTurnId: string | null;

  // Scroll management
  /** The target for the timeline's scroll controller, or null if no target is pending */
  pendingScrollTarget: TimelineScrollTarget | null;
  /** Whether we should stick to the bottom to follow new tokens being generated */
  shouldAutoFollow: () => boolean;

  // Actions
  setPendingScrollTarget: (t: TimelineScrollTarget | null) => void;
  setShouldAutoFollow: (cb: () => boolean) => void;
  setSelectedCharacter: (characterId: string | null) => void;
  setPreviewLeaf: (leafTurnId: string | null) => void;
  reset: () => void;
}

const initialState = {
  selectedCharacterId: null,
  previewLeafTurnId: null,
  pendingScrollTarget: null,
  shouldAutoFollow: () => false,
};

export const useScenarioPlayerStore = create<ScenarioPlayerState>()(
  immer((set) => ({
    ...initialState,

    setSelectedCharacter: (characterId) =>
      set((state) => {
        state.selectedCharacterId = characterId;
      }),

    setPreviewLeaf: (leafTurnId) =>
      set((state) => {
        state.previewLeafTurnId = leafTurnId;
      }),

    setPendingScrollTarget: (t) =>
      set((s) => {
        s.pendingScrollTarget = t;
      }),

    setShouldAutoFollow: (cb) =>
      set((s) => {
        s.shouldAutoFollow = cb;
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, initialState);
      }),
  }))
);
