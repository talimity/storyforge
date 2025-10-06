import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTRPC } from "@/lib/trpc";

interface UseCharacterSearchOptions {
  filterMode?: "all" | "inScenario" | "notInScenario";
  scenarioId?: string;
  enabled?: boolean;
}

export function useCharacterSearch(options: UseCharacterSearchOptions = {}) {
  const trpc = useTRPC();
  const { filterMode = "all", scenarioId, enabled = true } = options;
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = useQuery(
    trpc.characters.search.queryOptions(
      { name: searchQuery, filterMode, scenarioId },
      { placeholderData: keepPreviousData, enabled, staleTime: 30 * 1000 }
    )
  );

  const characters = useMemo(() => data?.characters ?? [], [data?.characters]);

  const updateSearch = (query: string) => setSearchQuery(query);

  return {
    characters,
    isLoading,
    error,
    searchQuery,
    updateSearch,
  };
}
