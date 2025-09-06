import { keepPreviousData } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";

export function useModelProfileSearch(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } =
    trpc.providers.searchModelProfiles.useQuery(
      { q: searchQuery },
      { placeholderData: keepPreviousData, enabled, staleTime: 5000 }
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
