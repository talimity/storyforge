import type { SourceHandlerMap } from "@storyforge/prompt-rendering";
import { exactKeys } from "@storyforge/utils";
import type { NarrativeContext } from "./context.js";
import type { ChapterSummaryContext, CharacterContext, TurnContext } from "./dtos.js";
import { applyChapterWindow, type ChapterWindow } from "./utils/chapter-window.js";

type TurnsArgs = {
  start?: number;
  end?: number;
  chapterWindow?: ChapterWindow;
};

export type NarrativeSources = {
  turns: {
    args: TurnsArgs | undefined;
    out: TurnContext[];
  };
  characters: {
    args: never | undefined;
    out: CharacterContext[];
  };
  chapterSummaries: {
    args: { order?: "asc" | "desc" } | undefined;
    out: ChapterSummaryContext[];
  };
};

export function makeNarrativeSourceHandlers<Ctx extends NarrativeContext>(): Pick<
  SourceHandlerMap<Ctx, NarrativeSources>,
  keyof NarrativeSources
> {
  return {
    turns: ({ args }, ctx): TurnContext[] => {
      const turns = ctx.turns;
      if (turns.length === 0) {
        return [];
      }

      const { start, end, chapterWindow } = args ?? {};
      const normalize = (index: number, length: number) => (index < 0 ? length + index : index);

      let result = [...turns];

      if (chapterWindow) {
        result = applyChapterWindow(result, chapterWindow);
      }

      if (typeof start === "number" || typeof end === "number") {
        const from = normalize(start ?? 0, result.length);
        const to = normalize(end ?? result.length - 1, result.length);
        result = result.slice(Math.max(0, from), Math.min(result.length, to + 1));
      }

      return result.reverse();
    },

    characters: (_ref, ctx) => ctx.characters,

    chapterSummaries: (ref, ctx) => {
      const summaries = ctx.chapterSummaries ?? [];
      const { order = "desc" } = ref.args ?? {};
      return [...summaries].sort((a, b) =>
        order === "asc" ? a.chapterNumber - b.chapterNumber : b.chapterNumber - a.chapterNumber
      );
    },
  };
}

export const NARRATIVE_SOURCE_NAMES = exactKeys<NarrativeSources>()(
  "turns",
  "characters",
  "chapterSummaries"
);
