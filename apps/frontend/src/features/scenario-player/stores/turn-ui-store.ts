import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type TurnOverlay = { mode: "delete" } | { mode: "retry"; branchFromTurnId: string | null };

interface TurnUiState {
  editingTurnId: string | null;
  overlaysByTurnId: Record<string, TurnOverlay>;
  editedContentByTurnId: Record<string, string>;
  uiCutoffAfterTurnId: string | null;
  pinnedTurnIds: Record<string, true>;
  manualInsertTargetId: string | null;

  startEditing: (turnId: string, initialContent: string) => void;
  stopEditing: () => void;
  setEditedContent: (turnId: string, content: string) => void;

  openDeleteOverlay: (turnId: string) => void;
  openRetryOverlay: (options: {
    turnId: string;
    branchFromTurnId: string | null;
    cutoffTurnId: string | null;
  }) => void;
  closeOverlay: (turnId: string) => void;

  openManualInsert: (turnId: string) => void;
  closeManualInsert: () => void;

  clearUiCutoff: () => void;
}

export const useTurnUiStore = create<TurnUiState>()(
  immer((set) => ({
    editingTurnId: null,
    overlaysByTurnId: {},
    editedContentByTurnId: {},
    uiCutoffAfterTurnId: null,
    pinnedTurnIds: {},
    manualInsertTargetId: null,

    startEditing: (turnId, initialContent) =>
      set((state) => {
        if (
          state.editingTurnId &&
          state.editingTurnId !== turnId &&
          !state.overlaysByTurnId[state.editingTurnId]
        ) {
          delete state.pinnedTurnIds[state.editingTurnId];
          delete state.editedContentByTurnId[state.editingTurnId];
        }
        state.editingTurnId = turnId;
        state.pinnedTurnIds[turnId] = true;
        state.editedContentByTurnId[turnId] = initialContent;
      }),

    stopEditing: () =>
      set((state) => {
        const current = state.editingTurnId;
        if (!current) {
          return;
        }
        state.editingTurnId = null;
        if (!state.overlaysByTurnId[current]) {
          delete state.pinnedTurnIds[current];
        }
        delete state.editedContentByTurnId[current];
      }),

    setEditedContent: (turnId, content) =>
      set((state) => {
        state.editedContentByTurnId[turnId] = content;
      }),

    openDeleteOverlay: (turnId) =>
      set((state) => {
        state.overlaysByTurnId[turnId] = { mode: "delete" };
        state.pinnedTurnIds[turnId] = true;
      }),

    openRetryOverlay: ({ turnId, branchFromTurnId, cutoffTurnId }) =>
      set((state) => {
        state.overlaysByTurnId[turnId] = { mode: "retry", branchFromTurnId };
        state.pinnedTurnIds[turnId] = true;
        state.uiCutoffAfterTurnId = cutoffTurnId ?? turnId;
      }),

    closeOverlay: (turnId) =>
      set((state) => {
        delete state.overlaysByTurnId[turnId];
        if (state.editingTurnId !== turnId) {
          delete state.pinnedTurnIds[turnId];
        }
        const hasRetryOverlay = Object.values(state.overlaysByTurnId).some(
          (overlay) => overlay.mode === "retry"
        );
        if (!hasRetryOverlay) {
          state.uiCutoffAfterTurnId = null;
        }
      }),

    openManualInsert: (turnId) =>
      set((state) => {
        state.manualInsertTargetId = turnId;
      }),

    closeManualInsert: () =>
      set((state) => {
        state.manualInsertTargetId = null;
      }),

    clearUiCutoff: () =>
      set((state) => {
        state.uiCutoffAfterTurnId = null;
      }),
  }))
);

export const selectOverlayForTurn = (turnId: string) => (state: TurnUiState) =>
  state.overlaysByTurnId[turnId] ?? null;

export const selectEditedContentForTurn =
  (turnId: string, fallback: string) => (state: TurnUiState) =>
    state.editedContentByTurnId[turnId] ?? fallback;
