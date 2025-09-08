import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useTRPC } from "@/lib/trpc";

export function useModelProfileSearch(options: { enabled?: boolean } = {}) {
  const trpc = useTRPC();
  const { enabled = true } = options;
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = useQuery(
    trpc.providers.searchModelProfiles.queryOptions(
      { q: searchQuery },
      { placeholderData: keepPreviousData, enabled, staleTime: 5000 }
    )
  );

  const updateSearch = useCallback((q: string) => setSearchQuery(q), []);

  return {
    modelProfiles: data?.modelProfiles ?? [],
    isLoading,
    error,
    searchQuery,
    updateSearch,
  };
}
