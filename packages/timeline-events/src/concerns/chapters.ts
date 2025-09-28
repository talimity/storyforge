import { assertDefined } from "@storyforge/utils";
import { z } from "zod";
import type { TimelineConcernSpec, TimelineEventSpec } from "../types.js";

const chapterBreakEventSchema = z.object({
  nextChapterTitle: z.string().optional(),
});

const chaptersStateSchema = z.object({
  chapters: z.array(
    z.object({
      number: z.number(),
      title: z.string(),
      turnId: z.string().nullable(),
    })
  ),
});

export type ChapterBreakEvent = z.infer<typeof chapterBreakEventSchema>;
export type ChaptersState = z.infer<typeof chaptersStateSchema>;
type ChapterBreakHint = { chapterNumber: number };

export const chapterBreakSpec: TimelineEventSpec<
  "chapter_break",
  ChapterBreakEvent,
  ChapterBreakHint
> = {
  kind: "chapter_break",
  latest: 1,
  schema: chapterBreakEventSchema,
  parse: ({ payload }) => ({
    version: 1,
    payload: chapterBreakSpec.schema.parse(payload),
  }),
  toPrompt: (ev, hint) => {
    assertDefined(hint);
    return ev.payload.nextChapterTitle
      ? `Chapter ${hint.chapterNumber} begins: ${ev.payload.nextChapterTitle}`
      : `Chapter ${hint.chapterNumber} begins`;
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
          title: ev.payload.nextChapterTitle ?? "",
          turnId: ev.turnId,
        },
      ],
    };
  },
  hints: {
    // lets us decorate chapter break events with their calculated number as
    // we reduce the chapters concern
    chapter_break: (s) => ({
      chapterNumber: s.chapters.length,
    }),
  },
};
