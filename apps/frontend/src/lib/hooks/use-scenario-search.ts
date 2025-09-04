import { keepPreviousData } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

export function useScenarioSearch(
  options: { status?: "active" | "archived"; enabled?: boolean } = {}
) {
  const { status, enabled = true } = options;
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = trpc.scenarios.search.useQuery(
    { q: searchQuery, status },
    { placeholderData: keepPreviousData, enabled, staleTime: 5000 }
  );

  const scenarios = useMemo(() => data?.scenarios ?? [], [data?.scenarios]);

  const updateSearch = useCallback((q: string) => setSearchQuery(q), []);

  return { scenarios, isLoading, error, searchQuery, updateSearch };
}
