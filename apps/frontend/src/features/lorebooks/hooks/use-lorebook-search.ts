import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTRPC } from "@/lib/trpc";

interface UseLorebookSearchOptions {
  enabled?: boolean;
}

export function useLorebookSearch(options: UseLorebookSearchOptions = {}) {
  const trpc = useTRPC();
  const { enabled = true } = options;
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = useQuery(
    trpc.lorebooks.search.queryOptions(
      { q: searchQuery },
      { placeholderData: keepPreviousData, enabled, staleTime: 30 * 1000 }
    )
  );

  const lorebooks = useMemo(() => data?.lorebooks ?? [], [data?.lorebooks]);

  const updateSearch = (q: string) => setSearchQuery(q);

  return {
    lorebooks,
    isLoading,
    error,
    searchQuery,
    updateSearch,
  };
}
