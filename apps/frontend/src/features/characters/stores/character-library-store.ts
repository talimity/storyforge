import type { CardType, CharacterLibrarySort } from "@storyforge/contracts";
import { cardTypeSchema, characterLibrarySortSchema } from "@storyforge/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  LibraryUrlSyncDescriptor,
  PersistedUseStore,
} from "@/features/library/hooks/use-library-url-sync";

const STORAGE_KEY = "storyforge:character-library-preferences";
const STORE_VERSION = 1;

export type CharacterLibraryViewMode = "grid" | "list";

export interface CharacterLibrarySnapshot {
  sort: CharacterLibrarySort;
  viewMode: CharacterLibraryViewMode;
  actorTypes: CardType[];
  starredOnly: boolean;
  searchTerm: string;
}

interface CharacterLibraryActions {
  setSort: (value: CharacterLibrarySort) => void;
  setViewMode: (value: CharacterLibraryViewMode) => void;
  setActorTypes: (value: CardType[]) => void;
  setStarredOnly: (value: boolean) => void;
  setSearchTerm: (value: string) => void;
  clearFilters: () => void;
  clearSearch: () => void;
}

export type CharacterLibraryStoreState = CharacterLibrarySnapshot & CharacterLibraryActions;

const defaultSnapshot: CharacterLibrarySnapshot = {
  sort: "default",
  viewMode: "grid",
  actorTypes: [],
  starredOnly: false,
  searchTerm: "",
};

function uniqueActorTypes(next: CardType[]): CardType[] {
  const seen = new Set<CardType>();
  const unique: CardType[] = [];
  next.forEach((value) => {
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    unique.push(value);
  });
  return unique;
}

function areActorTypesEqual(first: CardType[], second: CardType[]): boolean {
  if (first.length !== second.length) {
    return false;
  }
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) {
      return false;
    }
  }
  return true;
}

function sanitizeSearchTerm(term: string): string {
  return term.trim();
}

const storage =
  typeof window === "undefined" ? undefined : createJSONStorage(() => window.localStorage);

export const useCharacterLibraryStore: PersistedUseStore<CharacterLibraryStoreState> =
  create<CharacterLibraryStoreState>()(
    persist(
      (set, _get) => ({
        ...defaultSnapshot,
        setSort: (value) => {
          set((state) => {
            if (state.sort === value) {
              return state;
            }
            return { ...state, sort: value };
          });
        },
        setViewMode: (value) => {
          set((state) => {
            if (state.viewMode === value) {
              return state;
            }
            return { ...state, viewMode: value };
          });
        },
        setActorTypes: (value) => {
          const unique = uniqueActorTypes(value);
          set((state) => {
            if (areActorTypesEqual(state.actorTypes, unique)) {
              return state;
            }
            return { ...state, actorTypes: unique };
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
          const trimmed = sanitizeSearchTerm(value);
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
              !areActorTypesEqual(state.actorTypes, defaultSnapshot.actorTypes) ||
              state.starredOnly
            ) {
              return {
                ...state,
                actorTypes: [],
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
          viewMode: state.viewMode,
          actorTypes: state.actorTypes,
          starredOnly: state.starredOnly,
        }),
      }
    )
  );

export const selectCharacterSort = (state: CharacterLibraryStoreState) => state.sort;
export const selectCharacterViewMode = (state: CharacterLibraryStoreState) => state.viewMode;
export const selectCharacterActorTypes = (state: CharacterLibraryStoreState) => state.actorTypes;
export const selectCharacterStarredOnly = (state: CharacterLibraryStoreState) => state.starredOnly;
export const selectCharacterSearchTerm = (state: CharacterLibraryStoreState) => state.searchTerm;
export const selectCharacterSetSort = (state: CharacterLibraryStoreState) => state.setSort;
export const selectCharacterSetViewMode = (state: CharacterLibraryStoreState) => state.setViewMode;
export const selectCharacterSetActorTypes = (state: CharacterLibraryStoreState) =>
  state.setActorTypes;
export const selectCharacterSetStarredOnly = (state: CharacterLibraryStoreState) =>
  state.setStarredOnly;
export const selectCharacterSetSearchTerm = (state: CharacterLibraryStoreState) =>
  state.setSearchTerm;
export const selectCharacterClearFilters = (state: CharacterLibraryStoreState) =>
  state.clearFilters;
export const selectCharacterClearSearch = (state: CharacterLibraryStoreState) => state.clearSearch;

function readSortValue(raw: unknown): CharacterLibrarySort {
  if (typeof raw === "string") {
    const result = characterLibrarySortSchema.safeParse(raw);
    if (result.success) {
      return result.data;
    }
  }
  return defaultSnapshot.sort;
}

function readViewModeValue(raw: unknown): CharacterLibraryViewMode {
  return raw === "list" ? "list" : defaultSnapshot.viewMode;
}

function readActorTypesValue(raw: readonly string[]): CardType[] {
  const parsed: CardType[] = [];
  raw.forEach((value) => {
    const result = cardTypeSchema.safeParse(value);
    if (result.success) {
      parsed.push(result.data);
    }
  });
  return uniqueActorTypes(parsed);
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
    return sanitizeSearchTerm(raw);
  }
  return defaultSnapshot.searchTerm;
}

function equalsActorTypes(first: unknown, second: unknown): boolean {
  if (!Array.isArray(first) || !Array.isArray(second)) {
    return false;
  }
  return areActorTypesEqual(first as CardType[], second as CardType[]);
}

export const characterLibraryUrlDescriptors: ReadonlyArray<
  LibraryUrlSyncDescriptor<CharacterLibraryStoreState, unknown>
> = [
  {
    defaultValue: defaultSnapshot.sort,
    select: (state) => state.sort,
    parse: (params) => ({
      hasValue: params.has("sort"),
      value: readSortValue(params.get("sort")),
    }),
    serialize: (params, value, defaultValue) => {
      const sortValue = value as CharacterLibrarySort;
      const defaultValueTyped = defaultValue as CharacterLibrarySort;
      if (sortValue === defaultValueTyped) {
        params.delete("sort");
        return;
      }
      params.set("sort", sortValue);
    },
    apply: (value, storeRef) => {
      storeRef.getState().setSort(value as CharacterLibrarySort);
    },
  },
  {
    defaultValue: defaultSnapshot.viewMode,
    select: (state) => state.viewMode,
    parse: (params) => ({
      hasValue: params.has("view"),
      value: readViewModeValue(params.get("view")),
    }),
    serialize: (params, value, defaultValue) => {
      const modeValue = value as CharacterLibraryViewMode;
      const defaultValueTyped = defaultValue as CharacterLibraryViewMode;
      if (modeValue === defaultValueTyped) {
        params.delete("view");
        return;
      }
      params.set("view", modeValue);
    },
    apply: (value, storeRef) => {
      storeRef.getState().setViewMode(value as CharacterLibraryViewMode);
    },
  },
  {
    defaultValue: defaultSnapshot.actorTypes,
    select: (state) => state.actorTypes,
    parse: (params) => {
      const values = params.getAll("actorType");
      return {
        hasValue: values.length > 0,
        value: readActorTypesValue(values),
      };
    },
    serialize: (params, value) => {
      const actorTypes = value as CardType[];
      params.delete("actorType");
      actorTypes.forEach((actorType) => {
        params.append("actorType", actorType);
      });
    },
    apply: (value, storeRef) => {
      storeRef.getState().setActorTypes(value as CardType[]);
    },
    equals: equalsActorTypes,
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
