import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

type Options = {
  /** total rendered rows (used to detect prepends) */
  itemCount: number;
  /** called when the top sentinel becomes visible */
  onLoadMore?: () => void;
  /** disable loading logic */
  enabled?: boolean;
  /** true while fetching the next page (prevents repeated calls) */
  isFetching?: boolean;
  /** extra prefetch space above the viewport */
  rootMargin?: string; // e.g. "200px 0px 0px 0px"
  /** keep the viewport stable when new items are prepended */
  maintainScrollPosition?: boolean;
};

export function useAutoLoadMore({
  itemCount,
  onLoadMore,
  enabled = true,
  isFetching = false,
  rootMargin = "200px 0px 0px 0px",
  maintainScrollPosition = true,
}: Options) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Keep viewport stable on prepend
  const prevItemCountRef = useRef<number>(itemCount);
  const prevScrollHeightRef = useRef<number>(0);

  // snapshot the scrollHeight after each paint
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    prevScrollHeightRef.current = el.scrollHeight;
  });

  // when itemCount increases (top-load), adjust scrollTop by height delta
  useLayoutEffect(() => {
    if (!maintainScrollPosition) {
      prevItemCountRef.current = itemCount;
      return;
    }
    const el = containerRef.current;
    if (!el) {
      prevItemCountRef.current = itemCount;
      return;
    }

    const added = itemCount - prevItemCountRef.current;
    prevItemCountRef.current = itemCount;

    if (added > 0 && isFetching) {
      // list got taller above us; nudge down by the growth amount
      const newHeight = el.scrollHeight;
      const delta = newHeight - prevScrollHeightRef.current;
      if (delta > 0) el.scrollTop = el.scrollTop + delta;
    }
  }, [itemCount, isFetching, maintainScrollPosition]);

  // IntersectionObserver: load when top sentinel appears
  useEffect(() => {
    const root = containerRef.current;
    const target = sentinelRef.current;
    if (!enabled || !root || !target || !onLoadMore) return;

    let guard = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (guard || isFetching) return;
        guard = true;
        onLoadMore();
        // release guard next frame; isFetching flag is the real gate
        // biome-ignore lint/suspicious/noAssignInExpressions: dumb rule
        requestAnimationFrame(() => (guard = false));
      },
      { root, rootMargin, threshold: 0 }
    );

    io.observe(target);
    return () => io.disconnect();
  }, [enabled, isFetching, onLoadMore, rootMargin]);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  return { containerRef, topSentinelRef: sentinelRef, scrollToBottom };
}
