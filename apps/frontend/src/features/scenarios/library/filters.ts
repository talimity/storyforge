import type { ScenariosListQueryInput } from "@storyforge/contracts";
import { z } from "zod";
import { booleanParam, enumParam, stringParam } from "@/features/library/filter-param-helpers";
import type { FilterParamConfigMap } from "@/features/library/use-persisted-library-filters";

export const scenarioLibraryFilterSchema = z.object({
  search: z.string(),
  sort: z.enum(["default", "createdAt", "lastTurnAt", "turnCount", "starred", "participantCount"]),
  status: z.enum(["all", "active", "archived"]),
  starredOnly: z.boolean(),
});

export type ScenarioLibraryFilters = z.infer<typeof scenarioLibraryFilterSchema>;

export const scenarioLibraryFilterDefaults = scenarioLibraryFilterSchema.parse({
  search: "",
  sort: "default",
  status: "all",
  starredOnly: false,
});

const scenarioSortSchema = scenarioLibraryFilterSchema.shape.sort;

export const scenarioFilterParams: FilterParamConfigMap = {
  search: stringParam("search", { trim: true, omitWhen: (value) => value.length === 0 }),
  sort: enumParam({
    param: "sort",
    values: scenarioSortSchema.options,
    fallback: "default",
  }),
  status: enumParam({
    param: "status",
    values: ["active", "archived"],
    fallback: "all",
  }),
  starredOnly: booleanParam("starred"),
};

export const scenarioFilterStorageKey = "storyforge:filters:scenarios";
export const scenarioFilterVersion = 1;

export function createScenarioQueryInput(filters: ScenarioLibraryFilters): ScenariosListQueryInput {
  const result: ScenariosListQueryInput = {};
  const trimmedSearch = filters.search.trim();
  if (trimmedSearch.length > 0) {
    result.search = trimmedSearch;
  }
  if (filters.sort !== "default") {
    result.sort = filters.sort;
  }
  if (filters.status === "active" || filters.status === "archived") {
    result.status = filters.status;
  }
  if (filters.starredOnly) {
    result.starred = true;
  }
  return result;
}

export function parseScenarioSort(value: string) {
  return scenarioSortSchema.safeParse(value);
}
