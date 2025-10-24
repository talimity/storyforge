import type { CardType, CharactersListQueryInput } from "@storyforge/contracts";
import { cardTypeSchema } from "@storyforge/contracts";
import { z } from "zod";
import {
  booleanParam,
  delimitedArrayParam,
  enumParam,
  stringParam,
} from "@/features/library/filter-param-helpers";
import type { FilterParamConfigMap } from "@/features/library/use-persisted-library-filters";

export const characterLibraryFilterSchema = z.object({
  search: z.string(),
  sort: z.enum(["default", "createdAt", "lastTurnAt", "turnCount"]),
  viewMode: z.enum(["grid", "list"]),
  actorTypes: z.array(cardTypeSchema),
  starredOnly: z.boolean(),
});

export type CharacterLibraryFilters = z.infer<typeof characterLibraryFilterSchema>;

export const characterLibraryFilterDefaults = characterLibraryFilterSchema.parse({
  search: "",
  sort: "default",
  viewMode: "grid",
  actorTypes: [],
  starredOnly: false,
});

export const characterSortSchema = characterLibraryFilterSchema.shape.sort;
export const characterViewModeSchema = characterLibraryFilterSchema.shape.viewMode;

export const characterFilterParams: FilterParamConfigMap = {
  search: stringParam("search", { trim: true, omitWhen: (value) => value.length === 0 }),
  sort: enumParam({
    param: "sort",
    values: characterSortSchema.options,
    fallback: "default",
  }),
  viewMode: enumParam({
    param: "view",
    values: characterViewModeSchema.options,
    fallback: "grid",
    omitFallback: false,
  }),
  actorTypes: delimitedArrayParam<CardType>({
    param: "actorTypes",
    parseItem: (value) => {
      const parsed = cardTypeSchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    },
  }),
  starredOnly: booleanParam("starred"),
};

export const characterFilterStorageKey = "storyforge:filters:characters";
export const characterFilterVersion = 1;

export function createCharacterQueryInput(
  filters: CharacterLibraryFilters
): CharactersListQueryInput {
  const result: CharactersListQueryInput = {};
  const trimmedSearch = filters.search.trim();
  if (trimmedSearch.length > 0) {
    result.search = trimmedSearch;
  }
  if (filters.actorTypes.length > 0) {
    result.actorTypes = filters.actorTypes;
  }
  if (filters.starredOnly) {
    result.starred = true;
  }
  if (filters.sort !== "default") {
    result.sort = filters.sort;
  }
  return result;
}

export function parseCharacterSort(value: string) {
  return characterSortSchema.safeParse(value);
}

export function parseCharacterViewMode(value: string) {
  return characterViewModeSchema.safeParse(value);
}
