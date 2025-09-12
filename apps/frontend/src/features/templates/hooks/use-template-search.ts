import type { TaskKind } from "@storyforge/gentasks";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTRPC } from "@/lib/trpc";

export function useTemplateSearch(options: { task?: TaskKind; enabled?: boolean } = {}) {
  const trpc = useTRPC();
  const { task, enabled = true } = options;
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = useQuery(
    trpc.templates.list.queryOptions(
      { task, search: searchQuery || undefined },
      { placeholderData: keepPreviousData, enabled, staleTime: 60000 }
    )
  );

  const updateSearch = useCallback((q: string) => setSearchQuery(q), []);

  // Stabilize array identity to avoid re-running effects downstream on each render
  const templates = useMemo(() => data?.templates ?? [], [data?.templates]);

  return {
    templates,
    isLoading,
    error,
    searchQuery,
    updateSearch,
  };
}
