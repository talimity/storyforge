import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface ScenarioPlayerState {
  selectedCharacterId: string | null;

  // Actions
  setSelectedCharacter: (characterId: string | null) => void;
  reset: () => void;
}

const initialState = {
  selectedCharacterId: null,
};

export const useScenarioPlayerStore = create<ScenarioPlayerState>()(
  immer((set) => ({
    ...initialState,

    setSelectedCharacter: (characterId) =>
      set((state) => {
        state.selectedCharacterId = characterId;
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, initialState);
      }),
  }))
);
