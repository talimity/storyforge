import type { VirtualItem } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";

type Args = {
  items: VirtualItem[];
  hasNextPage?: boolean;
  onLoadMore?: () => Promise<unknown>;
  initialDataReceived: boolean;
};

export function useTimelineAutoLoadMore({
  items,
  hasNextPage,
  onLoadMore,
  initialDataReceived,
}: Args) {
  const lockRef = useRef(false);
  useEffect(() => {
    if (!hasNextPage || !onLoadMore) return; // no more data or no load more handler
    if (!initialDataReceived) return; // wait for initial data

    const first = items.at(0);
    const atTop = first?.key === "header";
    if (atTop && hasNextPage && !lockRef.current) {
      lockRef.current = true;
      onLoadMore?.()
        .catch(() => {})
        .finally(() => {
          lockRef.current = false;
        });
    }
  }, [items, hasNextPage, onLoadMore, initialDataReceived]);
}
