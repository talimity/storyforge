import { create } from "zustand";

interface ChapterRenameDialogState {
  eventId: string | null;
  openDialog: (eventId: string) => void;
  closeDialog: () => void;
}

export const useChapterRenameDialogStore = create<ChapterRenameDialogState>((set) => ({
  eventId: null,
  openDialog: (eventId) => set({ eventId }),
  closeDialog: () => set({ eventId: null }),
}));
