import type { LorebookAssignment } from "@storyforge/lorebooks";
import type { SourceHandlerMap } from "@storyforge/prompt-rendering";
import type { CharacterCtxDTO, TurnCtxDTO } from "../types.js";

export type ChapterSummaryCtxEntry = {
  closingEventId: string;
  closingTurnId: string;
  chapterNumber: number;
  title: string | null;
  summaryText: string;
  summaryJson?: unknown;
  updatedAt: Date;
};

export type NarrativeGlobalsBase = {
  scenario?: string;
};

export type NarrativeContextBase = {
  turns: TurnCtxDTO[];
  characters: CharacterCtxDTO[];
  lorebooks: readonly LorebookAssignment[];
  /**
   * Cached chapter summaries available to prompts; callers must only supply summaries for chapters
   * that are older than the one being generated.
   */
  chapterSummaries: readonly ChapterSummaryCtxEntry[];
};

export type NarrativeSourcesBase = {
  turns: {
    args: { order?: "asc" | "desc"; limit?: number; start?: number; end?: number } | undefined;
    out: TurnCtxDTO[];
  };
  characters: {
    args: { order?: "asc" | "desc"; limit?: number; ids?: string[] } | undefined;
    out: CharacterCtxDTO[];
  };
};

type TurnsArgs = NarrativeSourcesBase["turns"]["args"];
type CharactersArgs = NarrativeSourcesBase["characters"]["args"];

export function sliceTurns(turns: readonly TurnCtxDTO[], args?: TurnsArgs): TurnCtxDTO[] {
  const { order = "desc", limit, start, end } = args ?? {};
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

  return typeof limit === "number" ? result.slice(0, limit) : result;
}

export function selectCharacters(
  characters: readonly CharacterCtxDTO[],
  args?: CharactersArgs
): CharacterCtxDTO[] {
  const { order = "asc", limit, ids } = args ?? {};

  let result = [...characters];

  if (ids?.length) {
    const allow = new Set(ids);
    result = result.filter((chara) => allow.has(chara.id));
  }

  if (order === "desc") {
    result = result.slice().reverse();
  }

  return typeof limit === "number" ? result.slice(0, limit) : result;
}

export function makeNarrativeSourceHandlers<Ctx extends NarrativeContextBase>(): Pick<
  SourceHandlerMap<Ctx, NarrativeSourcesBase>,
  keyof NarrativeSourcesBase
> {
  return {
    turns: (ref, ctx) => sliceTurns(ctx.turns, ref.args),
    characters: (ref, ctx) => selectCharacters(ctx.characters, ref.args),
  };
}
