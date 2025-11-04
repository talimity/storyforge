import type { SourceHandlerMap } from "@storyforge/prompt-rendering";
import { exactKeys } from "@storyforge/utils";
import type { NarrativeContext } from "./context.js";
import type { ChapterSummaryContext, CharacterContext, TurnContext } from "./dtos.js";

type TurnsArgs = {
  order?: "asc" | "desc";
  start?: number;
  end?: number;
  /**
   * If provided, truncates the returned turns based on chapter boundaries.
   */
  chapterLimit?: {
    /**
     * Number of past chapters' turns that should be returned before truncation.
     * Turns beyond this range will be excluded, unless more turns are needed to
     * meet the `minTurns` requirement.
     *
     * Example:
     * - If set to 0, only the current chapter's turns will be returned.
     * - If set to 2, the current chapter and the two preceding chapters' turns
     * will be returned.
     */
    maxPastChapters: number;
    /**
     * Minimum number of turns that must be returned before any chapter-based
     * truncation is applied. If the number of turns in the selected range is
     * less than this value, then turns from chapters prior to the specified
     * number of past chapters will be included until this minimum is met.
     */
    minTurns: number;
  };
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
      const { order = "desc", start, end } = args ?? {};
      const normalize = (index: number, length: number) => (index < 0 ? length + index : index);

      let result = [...turns];

      if (typeof start === "number" || typeof end === "number") {
        const from = normalize(start ?? 0, result.length);
        const to = normalize(end ?? result.length - 1, result.length);
        result = result.slice(Math.max(0, from), Math.min(result.length, to + 1));
      }

      if (order === "desc") {
        result = result.slice().reverse();
      }

      return result;
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
