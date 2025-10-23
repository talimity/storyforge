import type { ScenarioLibrarySort } from "@storyforge/contracts";
import { scenarioLibrarySortSchema } from "@storyforge/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  LibraryUrlSyncDescriptor,
  PersistedUseStore,
} from "@/features/library/hooks/use-library-url-sync";
import type { ScenarioStatusFilter } from "@/features/scenarios/components/scenario-filters";

const STORAGE_KEY = "storyforge:scenario-library-preferences";
const STORE_VERSION = 1;

export interface ScenarioLibrarySnapshot {
  sort: ScenarioLibrarySort;
  status: ScenarioStatusFilter;
  starredOnly: boolean;
  searchTerm: string;
}

interface ScenarioLibraryActions {
  setSort: (value: ScenarioLibrarySort) => void;
  setStatus: (value: ScenarioStatusFilter) => void;
  setStarredOnly: (value: boolean) => void;
  setSearchTerm: (value: string) => void;
  clearFilters: () => void;
  clearSearch: () => void;
}

export type ScenarioLibraryStoreState = ScenarioLibrarySnapshot & ScenarioLibraryActions;

const defaultSnapshot: ScenarioLibrarySnapshot = {
  sort: "default",
  status: "all",
  starredOnly: false,
  searchTerm: "",
};

function sanitizeStatus(value: ScenarioStatusFilter | string | null): ScenarioStatusFilter {
  if (value === "active" || value === "archived") {
    return value;
  }
  return defaultSnapshot.status;
}

function sanitizeSearch(value: string): string {
  return value.trim();
}

const storage =
  typeof window === "undefined" ? undefined : createJSONStorage(() => window.localStorage);

export const useScenarioLibraryStore: PersistedUseStore<ScenarioLibraryStoreState> =
  create<ScenarioLibraryStoreState>()(
    persist(
      (set) => ({
        ...defaultSnapshot,
        setSort: (value) => {
          set((state) => {
            if (state.sort === value) {
              return state;
            }
            return { ...state, sort: value };
          });
        },
        setStatus: (value) => {
          set((state) => {
            if (state.status === value) {
              return state;
            }
            return { ...state, status: value };
          });
        },
        setStarredOnly: (value) => {
          set((state) => {
            if (state.starredOnly === value) {
              return state;
            }
            return { ...state, starredOnly: value };
          });
        },
        setSearchTerm: (value) => {
          const trimmed = sanitizeSearch(value);
          set((state) => {
            if (state.searchTerm === trimmed) {
              return state;
            }
            return { ...state, searchTerm: trimmed };
          });
        },
        clearFilters: () => {
          set((state) => {
            if (
              state.status !== defaultSnapshot.status ||
              state.starredOnly !== defaultSnapshot.starredOnly
            ) {
              return {
                ...state,
                status: defaultSnapshot.status,
                starredOnly: defaultSnapshot.starredOnly,
              };
            }
            return state;
          });
        },
        clearSearch: () => {
          set((state) => {
            if (state.searchTerm === defaultSnapshot.searchTerm) {
              return state;
            }
            return { ...state, searchTerm: defaultSnapshot.searchTerm };
          });
        },
      }),
      {
        name: STORAGE_KEY,
        storage,
        version: STORE_VERSION,
        partialize: (state) => ({
          sort: state.sort,
          status: state.status,
          starredOnly: state.starredOnly,
        }),
      }
    )
  );

export const selectScenarioSort = (state: ScenarioLibraryStoreState) => state.sort;
export const selectScenarioStatus = (state: ScenarioLibraryStoreState) => state.status;
export const selectScenarioStarredOnly = (state: ScenarioLibraryStoreState) => state.starredOnly;
export const selectScenarioSearchTerm = (state: ScenarioLibraryStoreState) => state.searchTerm;
export const selectScenarioSetSort = (state: ScenarioLibraryStoreState) => state.setSort;
export const selectScenarioSetStatus = (state: ScenarioLibraryStoreState) => state.setStatus;
export const selectScenarioSetStarredOnly = (state: ScenarioLibraryStoreState) =>
  state.setStarredOnly;
export const selectScenarioSetSearchTerm = (state: ScenarioLibraryStoreState) =>
  state.setSearchTerm;
export const selectScenarioClearFilters = (state: ScenarioLibraryStoreState) => state.clearFilters;
export const selectScenarioClearSearch = (state: ScenarioLibraryStoreState) => state.clearSearch;

function readSortValue(raw: string | null): ScenarioLibrarySort {
  if (typeof raw === "string") {
    const result = scenarioLibrarySortSchema.safeParse(raw);
    if (result.success) {
      return result.data;
    }
  }
  return defaultSnapshot.sort;
}

function readStatusValue(raw: string | null): ScenarioStatusFilter {
  if (typeof raw === "string") {
    return sanitizeStatus(raw);
  }
  return defaultSnapshot.status;
}

function readStarredValue(raw: string | boolean | null): boolean {
  if (typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "string") {
    return raw === "true";
  }
  return defaultSnapshot.starredOnly;
}

function readSearchValue(raw: string | null): string {
  if (typeof raw === "string") {
    return sanitizeSearch(raw);
  }
  return defaultSnapshot.searchTerm;
}

export const scenarioLibraryUrlDescriptors: ReadonlyArray<
  LibraryUrlSyncDescriptor<ScenarioLibraryStoreState, unknown>
> = [
  {
    defaultValue: defaultSnapshot.sort,
    select: (state) => state.sort,
    parse: (params) => ({
      hasValue: params.has("sort"),
      value: readSortValue(params.get("sort")),
    }),
    serialize: (params, value, defaultValue) => {
      const sortValue = value as ScenarioLibrarySort;
      const defaultValueTyped = defaultValue as ScenarioLibrarySort;
      if (sortValue === defaultValueTyped) {
        params.delete("sort");
        return;
      }
      params.set("sort", sortValue);
    },
    apply: (value, storeRef) => {
      storeRef.getState().setSort(value as ScenarioLibrarySort);
    },
  },
  {
    defaultValue: defaultSnapshot.status,
    select: (state) => state.status,
    parse: (params) => ({
      hasValue: params.has("status"),
      value: readStatusValue(params.get("status")),
    }),
    serialize: (params, value, defaultValue) => {
      const statusValue = value as ScenarioStatusFilter;
      const defaultValueTyped = defaultValue as ScenarioStatusFilter;
      if (statusValue === defaultValueTyped) {
        params.delete("status");
        return;
      }
      params.set("status", statusValue);
    },
    apply: (value, storeRef) => {
      storeRef.getState().setStatus(value as ScenarioStatusFilter);
    },
  },
  {
    defaultValue: defaultSnapshot.starredOnly,
    select: (state) => state.starredOnly,
    parse: (params) => ({
      hasValue: params.has("starred"),
      value: readStarredValue(params.get("starred")),
    }),
    serialize: (params, value, defaultValue) => {
      const starredValue = value as boolean;
      const defaultValueTyped = defaultValue as boolean;
      if (starredValue === defaultValueTyped) {
        params.delete("starred");
        return;
      }
      if (starredValue) {
        params.set("starred", "true");
        return;
      }
      params.delete("starred");
    },
    apply: (value, storeRef) => {
      storeRef.getState().setStarredOnly(Boolean(value));
    },
  },
  {
    defaultValue: defaultSnapshot.searchTerm,
    select: (state) => state.searchTerm,
    parse: (params) => ({
      hasValue: params.has("search"),
      value: readSearchValue(params.get("search")),
    }),
    serialize: (params, value) => {
      const searchValue = value as string;
      if (!searchValue) {
        params.delete("search");
        return;
      }
      params.set("search", searchValue);
    },
    apply: (value, storeRef) => {
      storeRef.getState().setSearchTerm(String(value));
    },
  },
];
