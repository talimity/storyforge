import type { VirtualItem } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";

type Args = {
  items: VirtualItem[];
  hasNextPage?: boolean;
  onLoadMore?: () => Promise<unknown>;
  initialDataReceivedRef: React.RefObject<boolean>;
};

export function useTimelineAutoLoadMore({
  items,
  hasNextPage,
  onLoadMore,
  initialDataReceivedRef,
}: Args) {
  const lockRef = useRef(false);
  useEffect(() => {
    if (!hasNextPage || !onLoadMore) return; // no more data or no load more handler
    if (!initialDataReceivedRef.current) return; // wait for initial data

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
  }, [items, hasNextPage, onLoadMore, initialDataReceivedRef]);
}
