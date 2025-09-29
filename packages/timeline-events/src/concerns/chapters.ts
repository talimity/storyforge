import { z } from "zod";
import type { TimelineConcernSpec, TimelineEventSpec } from "../types.js";

const chapterBreakEventSchema = z.object({
  nextChapterTitle: z.string().nullable(),
});

const chaptersStateSchema = z.object({
  chapters: z.array(
    z.object({
      number: z.number(),
      title: z.string().nullable(),
      turnId: z.string().nullable(),
      eventId: z.string(),
    })
  ),
});

export type ChapterBreakEvent = z.infer<typeof chapterBreakEventSchema>;
export type ChaptersState = z.infer<typeof chaptersStateSchema>;

export const chapterBreakSpec: TimelineEventSpec<"chapter_break", ChapterBreakEvent> = {
  kind: "chapter_break",
  latest: 1,
  schema: chapterBreakEventSchema,
  parse: ({ payload }) => ({
    version: 1,
    payload: chapterBreakSpec.schema.parse(payload),
  }),
  toPrompt: (ev, state) => {
    const chapterNumber = state.chapters.chapters.length;
    return ev.payload.nextChapterTitle
      ? `Chapter ${chapterNumber} begins: ${ev.payload.nextChapterTitle}`
      : `Chapter ${chapterNumber} begins`;
  },
};

export const chaptersConcern: TimelineConcernSpec<"chapters", "chapter_break", ChaptersState> = {
  name: "chapters",
  eventKinds: ["chapter_break"],
  schema: chaptersStateSchema,
  initial: () => ({ chapters: [] }),
  step: (s, ev) => {
    return {
      chapters: [
        ...s.chapters,
        {
          number: s.chapters.length + 1,
          title: ev.payload.nextChapterTitle,
          turnId: ev.turnId,
          eventId: ev.id,
        },
      ],
    };
  },
};
