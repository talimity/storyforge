import { keepPreviousData } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

interface UseCharacterSearchOptions {
  scenarioId?: string;
  enabled?: boolean;
}

export function useCharacterSearch(options: UseCharacterSearchOptions = {}) {
  const { scenarioId, enabled = true } = options;
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = trpc.characters.search.useQuery(
    {
      name: searchQuery,
      scenarioId,
    },
    {
      placeholderData: keepPreviousData,
      enabled,
      staleTime: 5000,
    }
  );

  const characters = useMemo(() => data?.characters ?? [], [data?.characters]);

  const updateSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  return {
    characters,
    isLoading,
    error,
    searchQuery,
    updateSearch,
  };
}
