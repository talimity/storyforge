import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTRPC } from "@/lib/trpc";

export function useScenarioSearch(
  options: { status?: "active" | "archived"; enabled?: boolean } = {}
) {
  const trpc = useTRPC();
  const { status, enabled = true } = options;
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = useQuery(
    trpc.scenarios.search.queryOptions(
      { q: searchQuery, status },
      { placeholderData: keepPreviousData, enabled, staleTime: 5000 }
    )
  );

  const scenarios = useMemo(() => data?.scenarios ?? [], [data?.scenarios]);

  const updateSearch = useCallback((q: string) => setSearchQuery(q), []);

  return { scenarios, isLoading, error, searchQuery, updateSearch };
}
