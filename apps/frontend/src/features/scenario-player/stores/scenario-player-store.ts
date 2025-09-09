import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface ScenarioPlayerState {
  /** Character selected in the sidebar, the target for new intents */
  selectedCharacterId: string | null;
  /** ID of the turn that is currently being edited */
  editingTurnId: string | null;

  // Actions
  setSelectedCharacter: (characterId: string | null) => void;
  setEditingTurnId: (turnId: string | null) => void;
  reset: () => void;
}

const initialState = {
  selectedCharacterId: null,
  editingTurnId: null,
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
        console.log("Setting editing turn to ", turnId);
        state.editingTurnId = turnId;
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, initialState);
      }),
  }))
);
