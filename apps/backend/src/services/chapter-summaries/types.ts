export type ChapterNode = {
  chapter: ChapterEntry;
  closing: ChapterEntry | null;
};

export type ChapterEntry = {
  eventId: string;
  turnId: string | null;
  chapterNumber: number;
  title: string | null;
};
