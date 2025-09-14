import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface ScenarioPlayerState {
  /** Character selected in the sidebar, the target for new intents */
  selectedCharacterId: string | null;
  /** ID of the turn that is currently being edited */
  editingTurnId: string | null;
  /** ID of the leaf turn we are previewing an alternate timeline, or null when not previewing */
  previewLeafTurnId: string | null;

  // Actions
  setSelectedCharacter: (characterId: string | null) => void;
  setEditingTurnId: (turnId: string | null) => void;
  setPreviewLeaf: (leafTurnId: string | null) => void;
  reset: () => void;
}

const initialState = {
  selectedCharacterId: null,
  editingTurnId: null,
  previewLeafTurnId: null,
};

export const useScenarioPlayerStore = create<ScenarioPlayerState>()(
  immer((set) => ({
    ...initialState,

    setSelectedCharacter: (characterId) =>
      set((state) => {
        state.selectedCharacterId = characterId;
      }),

    setEditingTurnId: (turnId) =>
      set((state) => {
        state.editingTurnId = turnId;
      }),

    setPreviewLeaf: (leafTurnId) =>
      set((state) => {
        state.previewLeafTurnId = leafTurnId;
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, initialState);
      }),
  }))
);
