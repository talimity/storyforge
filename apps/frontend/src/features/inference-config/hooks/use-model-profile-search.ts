import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTRPC } from "@/lib/trpc";

export function useModelProfileSearch(options: { enabled?: boolean } = {}) {
  const trpc = useTRPC();
  const { enabled = true } = options;
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = useQuery(
    trpc.providers.searchModelProfiles.queryOptions(
      { q: searchQuery },
      { placeholderData: keepPreviousData, enabled, staleTime: 30 * 1000 }
    )
  );

  const updateSearch = (q: string) => setSearchQuery(q);

  // Ensure stable array identity so downstream effects don't re-run every render
  const modelProfiles = useMemo(() => data?.modelProfiles ?? [], [data?.modelProfiles]);

  return {
    modelProfiles,
    isLoading,
    error,
    searchQuery,
    updateSearch,
  };
}
