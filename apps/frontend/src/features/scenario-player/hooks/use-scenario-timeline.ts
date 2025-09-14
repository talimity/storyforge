import type { TimelineTurn } from "@storyforge/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTRPC } from "@/lib/trpc";

interface UseScenarioTimelineOptions {
  scenarioId: string;
  /**
   * The leaf turn whose root→leaf path defines the timeline to view. If omitted,
   * the server uses the scenario's current anchor.
   */
  leafTurnId?: string | null;
  windowSize?: number;
  layer?: string;
}

export function useScenarioTimeline({
  scenarioId,
  leafTurnId = null,
  windowSize = 30,
  layer = "presentation",
}: UseScenarioTimelineOptions) {
  const trpc = useTRPC();
  const query = useInfiniteQuery(
    trpc.play.timeline.infiniteQueryOptions(
      { scenarioId, layer, windowSize, timelineLeafTurnId: leafTurnId ?? undefined },
      {
        getNextPageParam: (prev) => prev.cursors.nextCursor ?? undefined,
        initialCursor: undefined,
        refetchOnWindowFocus: false,
      }
    )
  );

  const turns = useMemo(() => {
    const seen = new Set<string>();
    const out: TimelineTurn[] = [];
    const pages = query.data?.pages ?? [];

    // oldest page first → newest page last
    for (let i = pages.length - 1; i >= 0; i--) {
      for (const t of pages[i].timeline) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          out.push(t);
        }
      }
    }
    return out;
  }, [query.data]);

  const timelineDepth = query.data?.pages[0]?.timelineDepth ?? 0;

  return {
    turns,
    timelineDepth,
    hasNextPage: !!query.hasNextPage,
    isPending: query.isPending,
    isFetching: query.isFetchingNextPage || query.isPending,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}
