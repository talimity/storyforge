import type {
  CardType,
  CharacterLibrarySort,
  CharactersListQueryInput,
} from "@storyforge/contracts";
import { cardTypeSchema, characterLibrarySortSchema } from "@storyforge/contracts";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useHydratedSearchParams } from "@/features/library/hooks/use-hydrated-search-params";

const CHARACTER_LIBRARY_PERSIST_KEY = "character-library-preferences";

const characterLibraryPersistSchema = z.object({
  sort: characterLibrarySortSchema.optional(),
  view: z.enum(["grid", "list"]).optional(),
  actorTypes: z.array(cardTypeSchema).optional(),
  starred: z.boolean().optional(),
});

type CharacterLibraryPersistedState = z.infer<typeof characterLibraryPersistSchema>;

function parseCharacterViewMode(value: string | null): "grid" | "list" {
  return value === "list" ? "list" : "grid";
}

function parseCharacterSort(value: string | null): CharacterLibrarySort {
  if (!value) {
    return "default";
  }
  const parsed = characterLibrarySortSchema.safeParse(value);
  return parsed.success ? parsed.data : "default";
}

function parseActorTypes(params: URLSearchParams): CardType[] {
  const values = params.getAll("actorType");
  const types: CardType[] = [];
  for (const raw of values) {
    const parsed = cardTypeSchema.safeParse(raw);
    if (parsed.success && !types.includes(parsed.data)) {
      types.push(parsed.data);
    }
  }
  return types;
}

function hasCharacterQueryParams(params: URLSearchParams): boolean {
  if (params.has("sort")) return true;
  if (params.has("view")) return true;
  if (params.getAll("actorType").length > 0) return true;
  if (params.has("starred")) return true;
  return false;
}

function applyCharacterStoredState(
  params: URLSearchParams,
  stored: CharacterLibraryPersistedState
) {
  if (stored.sort && stored.sort !== "default") {
    params.set("sort", stored.sort);
  } else {
    params.delete("sort");
  }

  if (stored.view && stored.view !== "grid") {
    params.set("view", stored.view);
  } else {
    params.delete("view");
  }

  params.delete("actorType");
  stored.actorTypes?.forEach((type) => params.append("actorType", type));

  if (typeof stored.starred === "boolean") {
    if (stored.starred) {
      params.set("starred", "true");
    } else {
      params.delete("starred");
    }
  }
}

interface CharacterLibraryState {
  sort: CharacterLibrarySort;
  setSort: (value: string) => void;
  viewMode: "grid" | "list";
  setViewMode: (value: string) => void;
  actorTypes: CardType[];
  setActorTypes: (next: CardType[]) => void;
  starredOnly: boolean;
  setStarredOnly: (next: boolean) => void;
  isFilterActive: boolean;
  clearFilters: () => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  clearSearch: () => void;
  queryInput: CharactersListQueryInput;
}

export function useCharacterLibraryState(): CharacterLibraryState {
  const hydrationOptions = useMemo(
    () => ({
      storageKey: CHARACTER_LIBRARY_PERSIST_KEY,
      hasRelevantParams: hasCharacterQueryParams,
      parseStoredState: (raw: unknown) => {
        const result = characterLibraryPersistSchema.safeParse(raw);
        return result.success ? result.data : null;
      },
      applyStoredState: applyCharacterStoredState,
    }),
    []
  );

  const { searchParams, setSearchParams, isHydrated, storedState } =
    useHydratedSearchParams<CharacterLibraryPersistedState>(hydrationOptions);

  const sortParam = searchParams.get("sort");
  const sort =
    sortParam !== null ? parseCharacterSort(sortParam) : (storedState?.sort ?? "default");

  const viewParam = searchParams.get("view");
  const viewMode =
    viewParam !== null ? parseCharacterViewMode(viewParam) : (storedState?.view ?? "grid");

  const starredParam = searchParams.get("starred");
  const starredOnly = starredParam === "true" ? true : storedState?.starred === true;

  const actorTypesFromParams = parseActorTypes(searchParams);
  const actorTypes =
    actorTypesFromParams.length > 0 ? actorTypesFromParams : (storedState?.actorTypes ?? []);

  const searchParam = searchParams.get("search");
  const searchTerm = searchParam !== null ? searchParam : "";
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

    const payload: CharacterLibraryPersistedState = {
      sort,
      view: viewMode,
      actorTypes,
      starred: starredOnly,
    };

    try {
      window.localStorage.setItem(CHARACTER_LIBRARY_PERSIST_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error(error);
    }
  }, [actorTypes, isHydrated, sort, starredOnly, viewMode]);

  const updateParams = (mutator: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutator(next);
    setSearchParams(next, { replace: true });
  };

  const setSort = (value: string) => {
    const parsed = characterLibrarySortSchema.safeParse(value);
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

  const setViewMode = (value: string) => {
    if (value !== "grid" && value !== "list") {
      return;
    }

    updateParams((params) => {
      if (value === "grid") {
        params.delete("view");
      } else {
        params.set("view", value);
      }
    });
  };

  const setActorTypes = (nextTypes: CardType[]) => {
    updateParams((params) => {
      params.delete("actorType");
      nextTypes.forEach((type) => params.append("actorType", type));
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
      params.delete("actorType");
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

  const isFilterActive = starredOnly || actorTypes.length > 0;
  const trimmedSearch = searchTerm.trim();

  const queryInput: CharactersListQueryInput = {
    search: trimmedSearch.length > 0 ? trimmedSearch : undefined,
    sort,
    actorTypes: actorTypes.length > 0 ? actorTypes : undefined,
    starred: starredOnly ? true : undefined,
  };

  return {
    sort,
    setSort,
    viewMode,
    setViewMode,
    actorTypes,
    setActorTypes,
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

export type UseCharacterLibraryStateReturn = ReturnType<typeof useCharacterLibraryState>;
