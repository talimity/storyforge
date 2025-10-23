import type { ScenarioLibrarySort, ScenariosListQueryInput } from "@storyforge/contracts";
import { scenarioLibrarySortSchema } from "@storyforge/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLibraryUrlSync } from "@/features/library/hooks/use-library-url-sync";
import type { ScenarioStatusFilter } from "@/features/scenarios/components/scenario-filters";
import {
  scenarioLibraryUrlDescriptors,
  selectScenarioClearFilters,
  selectScenarioClearSearch,
  selectScenarioSearchTerm,
  selectScenarioSetSearchTerm,
  selectScenarioSetSort,
  selectScenarioSetStarredOnly,
  selectScenarioSetStatus,
  selectScenarioSort,
  selectScenarioStarredOnly,
  selectScenarioStatus,
  useScenarioLibraryStore,
} from "@/features/scenarios/stores/scenario-library-store";

const SEARCH_DEBOUNCE_MS = 300;

interface ScenarioLibraryState {
  sort: ScenarioLibrarySort;
  setSort: (value: string) => void;
  statusFilter: ScenarioStatusFilter;
  setStatusFilter: (value: ScenarioStatusFilter) => void;
  starredOnly: boolean;
  setStarredOnly: (value: boolean) => void;
  isFilterActive: boolean;
  clearFilters: () => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  clearSearch: () => void;
  queryInput: ScenariosListQueryInput;
}

export function useScenarioLibraryState(): ScenarioLibraryState {
  useLibraryUrlSync({
    store: useScenarioLibraryStore,
    descriptors: scenarioLibraryUrlDescriptors,
  });

  const sort = useScenarioLibraryStore(selectScenarioSort);
  const setSortAction = useScenarioLibraryStore(selectScenarioSetSort);
  const statusFilter = useScenarioLibraryStore(selectScenarioStatus);
  const setStatusAction = useScenarioLibraryStore(selectScenarioSetStatus);
  const starredOnly = useScenarioLibraryStore(selectScenarioStarredOnly);
  const setStarredOnly = useScenarioLibraryStore(selectScenarioSetStarredOnly);
  const clearFilters = useScenarioLibraryStore(selectScenarioClearFilters);
  const searchTerm = useScenarioLibraryStore(selectScenarioSearchTerm);
  const setSearchTerm = useScenarioLibraryStore(selectScenarioSetSearchTerm);
  const clearSearchAction = useScenarioLibraryStore(selectScenarioClearSearch);

  const [searchInput, setSearchInput] = useState(searchTerm);

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === searchTerm) {
      return;
    }
    const handle = window.setTimeout(() => {
      setSearchTerm(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput, searchTerm, setSearchTerm]);

  const handleSortChange = useCallback(
    (value: string) => {
      const result = scenarioLibrarySortSchema.safeParse(value);
      const nextValue = result.success ? result.data : "default";
      setSortAction(nextValue);
    },
    [setSortAction]
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const handleClearSearch = useCallback(() => {
    clearSearchAction();
    setSearchInput("");
  }, [clearSearchAction]);

  const isFilterActive = starredOnly || statusFilter !== "all";
  const trimmedSearch = searchTerm.trim();

  const queryInput: ScenariosListQueryInput = useMemo(
    () => ({
      search: trimmedSearch.length > 0 ? trimmedSearch : undefined,
      sort,
      status: statusFilter === "all" ? undefined : statusFilter,
      starred: starredOnly ? true : undefined,
    }),
    [sort, statusFilter, starredOnly, trimmedSearch]
  );

  return {
    sort,
    setSort: handleSortChange,
    statusFilter,
    setStatusFilter: setStatusAction,
    starredOnly,
    setStarredOnly,
    isFilterActive,
    clearFilters,
    searchInput,
    onSearchInputChange: handleSearchChange,
    clearSearch: handleClearSearch,
    queryInput,
  };
}

export type UseScenarioLibraryStateReturn = ReturnType<typeof useScenarioLibraryState>;
