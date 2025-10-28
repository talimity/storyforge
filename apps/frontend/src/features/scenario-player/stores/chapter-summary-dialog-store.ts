import { create } from "zustand";

interface ChapterSummaryDialogState {
  closingEventId: string | null;
  openDialog: (closingEventId: string) => void;
  closeDialog: () => void;
}

export const useChapterSummaryDialogStore = create<ChapterSummaryDialogState>((set) => ({
  closingEventId: null,
  openDialog: (closingEventId) => set({ closingEventId }),
  closeDialog: () => set({ closingEventId: null }),
}));
