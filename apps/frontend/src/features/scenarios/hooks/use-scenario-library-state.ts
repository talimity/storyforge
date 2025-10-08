import type { ScenarioLibrarySort, ScenariosListQueryInput } from "@storyforge/contracts";
import { scenarioLibrarySortSchema } from "@storyforge/contracts";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useHydratedSearchParams } from "@/features/library/hooks/use-hydrated-search-params";
import type { ScenarioStatusFilter } from "@/features/scenarios/components/scenario-filters";

const SCENARIO_LIBRARY_PERSIST_KEY = "scenario-library-preferences";

const scenarioLibraryPersistSchema = z.object({
  sort: scenarioLibrarySortSchema.optional(),
  status: z.enum(["all", "active", "archived"]).optional(),
  starred: z.boolean().optional(),
  search: z.string().optional(),
});

type ScenarioLibraryPersistedState = z.infer<typeof scenarioLibraryPersistSchema>;

function parseScenarioSort(value: string | null): ScenarioLibrarySort {
  if (!value) {
    return "default";
  }
  const parsed = scenarioLibrarySortSchema.safeParse(value);
  return parsed.success ? parsed.data : "default";
}

function parseScenarioStatus(value: string | null): ScenarioStatusFilter {
  if (value === "active" || value === "archived") {
    return value;
  }
  return "all";
}

function hasScenarioQueryParams(params: URLSearchParams): boolean {
  if (params.has("sort")) return true;
  if (params.has("status")) return true;
  if (params.has("starred")) return true;
  if (params.has("search")) return true;
  return false;
}

function applyScenarioStoredState(params: URLSearchParams, stored: ScenarioLibraryPersistedState) {
  if (stored.sort && stored.sort !== "default") {
    params.set("sort", stored.sort);
  } else {
    params.delete("sort");
  }

  if (stored.status && stored.status !== "all") {
    params.set("status", stored.status);
  } else {
    params.delete("status");
  }

  if (typeof stored.starred === "boolean") {
    if (stored.starred) {
      params.set("starred", "true");
    } else {
      params.delete("starred");
    }
  }

  if (stored.search && stored.search.length > 0) {
    params.set("search", stored.search);
  } else {
    params.delete("search");
  }
}

interface ScenarioLibraryState {
  sort: ScenarioLibrarySort;
  setSort: (value: string) => void;
  statusFilter: ScenarioStatusFilter;
  setStatusFilter: (value: ScenarioStatusFilter) => void;
  starredOnly: boolean;
  setStarredOnly: (next: boolean) => void;
  isFilterActive: boolean;
  clearFilters: () => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  clearSearch: () => void;
  queryInput: ScenariosListQueryInput;
}

export function useScenarioLibraryState(): ScenarioLibraryState {
  const hydrationOptions = useMemo(
    () => ({
      storageKey: SCENARIO_LIBRARY_PERSIST_KEY,
      hasRelevantParams: hasScenarioQueryParams,
      parseStoredState: (raw: unknown) => {
        const result = scenarioLibraryPersistSchema.safeParse(raw);
        return result.success ? result.data : null;
      },
      applyStoredState: applyScenarioStoredState,
    }),
    []
  );

  const { searchParams, setSearchParams, isHydrated, storedState } =
    useHydratedSearchParams<ScenarioLibraryPersistedState>(hydrationOptions);

  const sortParam = searchParams.get("sort");
  const sort = sortParam !== null ? parseScenarioSort(sortParam) : (storedState?.sort ?? "default");

  const statusParam = searchParams.get("status");
  const statusFilter =
    statusParam !== null ? parseScenarioStatus(statusParam) : (storedState?.status ?? "all");

  const starredParam = searchParams.get("starred");
  const starredOnly = starredParam === "true" ? true : storedState?.starred === true;

  const searchParam = searchParams.get("search");
  const searchTerm = searchParam !== null ? searchParam : (storedState?.search ?? "");
  const [searchInput, setSearchInput] = useState(searchTerm);

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    const trimmedInput = searchInput.trim();
    if (trimmedInput === searchTerm) {
      return;
    }

    const handle = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (trimmedInput.length === 0) {
        next.delete("search");
      } else {
        next.set("search", trimmedInput);
      }
      setSearchParams(next, { replace: true });
    }, 300);

    return () => window.clearTimeout(handle);
  }, [searchInput, searchTerm, searchParams, setSearchParams]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const payload: ScenarioLibraryPersistedState = {
      sort,
      status: statusFilter,
      starred: starredOnly,
      search: searchTerm,
    };

    try {
      window.localStorage.setItem(SCENARIO_LIBRARY_PERSIST_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error(error);
    }
  }, [isHydrated, sort, starredOnly, statusFilter, searchTerm]);

  const updateParams = (mutator: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutator(next);
    setSearchParams(next, { replace: true });
  };

  const setSort = (value: string) => {
    const parsed = scenarioLibrarySortSchema.safeParse(value);
    if (!parsed.success) {
      return;
    }

    updateParams((params) => {
      if (parsed.data === "default") {
        params.delete("sort");
      } else {
        params.set("sort", parsed.data);
      }
    });
  };

  const setStatusFilter = (value: ScenarioStatusFilter) => {
    updateParams((params) => {
      if (value === "all") {
        params.delete("status");
      } else {
        params.set("status", value);
      }
    });
  };

  const setStarredOnly = (next: boolean) => {
    updateParams((params) => {
      if (next) {
        params.set("starred", "true");
      } else {
        params.delete("starred");
      }
    });
  };

  const clearFilters = () => {
    updateParams((params) => {
      params.delete("status");
      params.delete("starred");
    });
  };

  const onSearchInputChange = (value: string) => {
    setSearchInput(value);
  };

  const clearSearch = () => {
    setSearchInput("");
    updateParams((params) => {
      params.delete("search");
    });
  };

  const isFilterActive = starredOnly || statusFilter !== "all";
  const trimmedSearch = searchTerm.trim();

  const queryInput: ScenariosListQueryInput = {
    search: trimmedSearch.length > 0 ? trimmedSearch : undefined,
    sort,
    status: statusFilter === "all" ? undefined : statusFilter,
    starred: starredOnly ? true : undefined,
  };

  return {
    sort,
    setSort,
    statusFilter,
    setStatusFilter,
    starredOnly,
    setStarredOnly,
    isFilterActive,
    clearFilters,
    searchInput,
    onSearchInputChange,
    clearSearch,
    queryInput,
  };
}

export type UseScenarioLibraryStateReturn = ReturnType<typeof useScenarioLibraryState>;
