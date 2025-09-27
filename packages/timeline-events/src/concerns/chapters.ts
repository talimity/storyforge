import { assertDefined } from "@storyforge/utils";
import { z } from "zod";
import type { TimelineConcernSpec, TimelineEventEnvelopeOf, TimelineEventSpec } from "../types.js";

const chapterBreakEventSchema = z.object({
  nextChapterTitle: z.string().optional(),
});

export type ChapterBreakEvent = z.infer<typeof chapterBreakEventSchema>;
type ChapterBreakHint = { chapterNumber: number };
export type ChaptersState = { count: number; last?: TimelineEventEnvelopeOf<"chapter_break"> };

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
  initial: () => ({ count: 0 }),
  step: (s, ev) => ({ count: s.count + 1, last: ev }),
  hints: {
    // lets us decorate chapter break events with their calculated number as
    // we reduce the chapters concern
    chapter_break: (s) => ({ chapterNumber: s.count + 1 }),
  },
};
