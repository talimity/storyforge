import type { VirtualItem } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import { debugLog } from "@/lib/debug";

type Args = {
  items: VirtualItem[];
  isFetching?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => Promise<unknown>;
  pendingInitialScroll: boolean;
};

export function useTimelineAutoLoadMore({
  items,
  isFetching,
  hasNextPage,
  onLoadMore,
  pendingInitialScroll,
}: Args) {
  const pendingScrollTarget = useScenarioPlayerStore((s) => s.pendingScrollTarget);
  const enabled = !pendingInitialScroll && !pendingScrollTarget;
  const lockRef = useRef(false);
  useEffect(() => {
    if (isFetching) return;
    if (!hasNextPage || !onLoadMore) return; // no more data or no load more handler
    if (!enabled) return; // wait for initial data

    const first = items.at(0);
    const atTop = first?.key === "header";
    if (atTop && hasNextPage && !lockRef.current) {
      lockRef.current = true;
      debugLog("timeline:auto-load-more", "auto-load more");
      onLoadMore?.()
        .catch(() => {})
        .finally(() => {
          debugLog("timeline:auto-load-more", "auto-load more finished");
          lockRef.current = false;
        });
    }
  }, [items, isFetching, hasNextPage, onLoadMore, enabled]);
}
