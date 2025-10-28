import type { ChapterSummaryStatus } from "@storyforge/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

const POLLING_INTERVAL_MS = 2000;

interface UseChapterSummaryStatusesArgs {
  scenarioId: string;
  leafTurnId: string | null;
}

export function useChapterSummaryStatuses(args: UseChapterSummaryStatusesArgs) {
  const { scenarioId, leafTurnId } = args;
  const trpc = useTRPC();

  const query = useQuery({
    ...trpc.chapterSummaries.listForPath.queryOptions(
      { scenarioId, leafTurnId: leafTurnId ?? undefined },
      { placeholderData: keepPreviousData }
    ),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasRunning = data.summaries.some((summary) => summary.state === "running");
      return hasRunning ? POLLING_INTERVAL_MS : false;
    },
  });

  const summaries = query.data?.summaries ?? [];
  const { byChapterEventId, byClosingEventId } = buildStatusMaps(summaries);

  return {
    summaries,
    statusesByChapterEventId: byChapterEventId,
    statusesByClosingEventId: byClosingEventId,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

function buildStatusMaps(statuses: ChapterSummaryStatus[]) {
  const byChapterEventId = new Map<string, ChapterSummaryStatus>();
  const byClosingEventId = new Map<string, ChapterSummaryStatus>();

  for (const status of statuses) {
    byChapterEventId.set(status.chapterEventId, status);
    if (status.closingEventId) {
      byClosingEventId.set(status.closingEventId, status);
    }
  }

  return { byChapterEventId, byClosingEventId };
}
