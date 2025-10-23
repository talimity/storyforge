import type {
  CardType,
  CharacterLibrarySort,
  CharactersListQueryInput,
} from "@storyforge/contracts";
import { characterLibrarySortSchema } from "@storyforge/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  characterLibraryUrlDescriptors,
  selectCharacterActorTypes,
  selectCharacterClearFilters,
  selectCharacterClearSearch,
  selectCharacterSearchTerm,
  selectCharacterSetActorTypes,
  selectCharacterSetSearchTerm,
  selectCharacterSetSort,
  selectCharacterSetStarredOnly,
  selectCharacterSetViewMode,
  selectCharacterSort,
  selectCharacterStarredOnly,
  selectCharacterViewMode,
  useCharacterLibraryStore,
} from "@/features/characters/stores/character-library-store";
import { useLibraryUrlSync } from "@/features/library/hooks/use-library-url-sync";

const SEARCH_DEBOUNCE_MS = 300;

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
  useLibraryUrlSync({
    store: useCharacterLibraryStore,
    descriptors: characterLibraryUrlDescriptors,
  });

  const sort = useCharacterLibraryStore(selectCharacterSort);
  const setSortAction = useCharacterLibraryStore(selectCharacterSetSort);
  const viewMode = useCharacterLibraryStore(selectCharacterViewMode);
  const setViewModeAction = useCharacterLibraryStore(selectCharacterSetViewMode);
  const actorTypes = useCharacterLibraryStore(selectCharacterActorTypes);
  const setActorTypes = useCharacterLibraryStore(selectCharacterSetActorTypes);
  const starredOnly = useCharacterLibraryStore(selectCharacterStarredOnly);
  const setStarredOnly = useCharacterLibraryStore(selectCharacterSetStarredOnly);
  const clearFilters = useCharacterLibraryStore(selectCharacterClearFilters);
  const searchTerm = useCharacterLibraryStore(selectCharacterSearchTerm);
  const setSearchTerm = useCharacterLibraryStore(selectCharacterSetSearchTerm);
  const clearSearchAction = useCharacterLibraryStore(selectCharacterClearSearch);

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
      const result = characterLibrarySortSchema.safeParse(value);
      const nextValue = result.success ? result.data : "default";
      setSortAction(nextValue);
    },
    [setSortAction]
  );

  const handleViewModeChange = useCallback(
    (value: string) => {
      if (value === "list" || value === "grid") {
        setViewModeAction(value);
        return;
      }
      setViewModeAction("grid");
    },
    [setViewModeAction]
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const handleClearSearch = useCallback(() => {
    clearSearchAction();
    setSearchInput("");
  }, [clearSearchAction]);

  const isFilterActive = starredOnly || actorTypes.length > 0;
  const trimmedSearch = searchTerm.trim();

  const queryInput: CharactersListQueryInput = useMemo(
    () => ({
      search: trimmedSearch.length > 0 ? trimmedSearch : undefined,
      sort,
      actorTypes: actorTypes.length > 0 ? actorTypes : undefined,
      starred: starredOnly ? true : undefined,
    }),
    [actorTypes, sort, starredOnly, trimmedSearch]
  );

  return {
    sort,
    setSort: handleSortChange,
    viewMode,
    setViewMode: handleViewModeChange,
    actorTypes,
    setActorTypes,
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

export type UseCharacterLibraryStateReturn = ReturnType<typeof useCharacterLibraryState>;
