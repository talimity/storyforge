import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from "react";

type UseTimelineScrollerOptions = {
  /** The real scrollable element (PlayerLayout's content Box) */
  containerRef: RefObject<HTMLDivElement | null>;
  /** The rendered, ordered list of turn ids (root → leaf). */
  itemIds: Array<string | number>;
  /** Load the next older window when the user reaches the very top. */
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  isFetching?: boolean;

  /** True while a draft is visible (generation pending/running). */
  isGenerating?: boolean;

  /** Distance in px that counts as "near bottom". Default 64. */
  nearBottomPx?: number;
};

type UseTimelineScrollerResult = {
  /** Goes at the top of the list. When it intersects, we'll call onLoadMore. */
  topSentinelRef: RefObject<HTMLDivElement | null>;
  /** Manually scroll the container to the bottom. */
  scrollToBottom: () => void;
  /** Ensure the element with the given data-turn-id is fully visible. */
  scrollTurnIntoView: (id: string | number) => void;
};

export function useTimelineScroller(opts: UseTimelineScrollerOptions): UseTimelineScrollerResult {
  const {
    containerRef,
    itemIds,
    onLoadMore,
    hasNextPage = false,
    isFetching = false,
    isGenerating = false,
    nearBottomPx = 64,
  } = opts;

  const topSentinelRef = useRef<HTMLDivElement | null>(null);

  // Snapshots used to detect prepends/appends & keep position stable.
  const prevCountRef = useRef(0);
  const prevFirstRef = useRef<string | number | undefined>(undefined);
  const prevLastRef = useRef<string | number | undefined>(undefined);
  const prevScrollHeightRef = useRef(0);

  // Follow-to-bottom state:
  // Enabled when generation starts *and* user was already near the bottom.
  const shouldFollowRef = useRef(false);
  const wasGeneratingRef = useRef(false);

  // Scroll metrics snapshot (updated on scroll)
  const lastScrollTopRef = useRef(0);
  const lastClientHeightRef = useRef(0);
  const lastScrollHeightRef = useRef(0);

  const getEl = useCallback(
    (id: string | number | undefined | null): HTMLElement | null => {
      const root = containerRef.current;
      if (!root || id == null) return null;
      try {
        return root.querySelector(`[data-turn-id="${String(id)}"]`) as HTMLElement | null;
      } catch {
        return null;
      }
    },
    [containerRef]
  );

  const isNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return false;
    const distance = el.scrollHeight - el.clientHeight - el.scrollTop;
    return distance <= nearBottomPx;
  }, [containerRef, nearBottomPx]);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight - el.clientHeight;
  }, [containerRef]);

  const scrollTurnIntoView = useCallback(
    (id: string | number) => {
      const scroller = containerRef.current;
      const itemEl = getEl(id);
      if (!scroller || !itemEl) return;

      const itemTop = itemEl.offsetTop;
      const itemBottom = itemTop + itemEl.offsetHeight;
      const viewTop = scroller.scrollTop;
      const viewBottom = viewTop + scroller.clientHeight;

      // Ensure entire element is visible if it fits; otherwise align to top.
      if (itemEl.offsetHeight <= scroller.clientHeight) {
        if (itemTop < viewTop) {
          scroller.scrollTop = itemTop;
        } else if (itemBottom > viewBottom) {
          scroller.scrollTop = itemBottom - scroller.clientHeight;
        }
      } else {
        scroller.scrollTop = itemTop;
      }
    },
    [containerRef, getEl]
  );

  // Keep scroll metrics up to date.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      lastScrollTopRef.current = el.scrollTop;
      lastClientHeightRef.current = el.clientHeight;
      lastScrollHeightRef.current = el.scrollHeight;

      // If the user scrolls up while we're following, stop following.
      if (shouldFollowRef.current && !isNearBottom()) {
        shouldFollowRef.current = false;
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // snapshot immediately
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [containerRef, isNearBottom]);

  // IntersectionObserver: trigger onLoadMore when the top sentinel is visible.
  useEffect(() => {
    const root = containerRef.current;
    const target = topSentinelRef.current;
    if (!root || !target || !onLoadMore || !hasNextPage) return;

    let guard = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (guard || isFetching) return;
        guard = true;
        onLoadMore();
        requestAnimationFrame(() => {
          guard = false;
        });
      },
      { root, rootMargin: "200px 0px 0px 0px", threshold: 0 }
    );

    io.observe(target);
    return () => io.disconnect();
  }, [containerRef, hasNextPage, isFetching, onLoadMore]);

  // Initial alignment: show the TOP of the last item.
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    if (prevCountRef.current !== 0) return; // run only on first non-empty render

    if (itemIds.length > 0) {
      const lastId = itemIds[itemIds.length - 1];
      // Align the top of the last item to the top of the viewport.
      const lastEl = getEl(lastId);
      if (lastEl) {
        const scroller = containerRef.current;
        scroller.scrollTop = lastEl.offsetTop;
      } else {
        // fallback: bottom
        scrollToBottom();
      }
    }
    // initialize snapshots
    const scroller = containerRef.current;
    if (scroller) {
      prevScrollHeightRef.current = scroller.scrollHeight;
    }
    prevCountRef.current = itemIds.length;
    prevFirstRef.current = itemIds[0];
    prevLastRef.current = itemIds[itemIds.length - 1];
  }, [containerRef, getEl, itemIds, scrollToBottom]);

  // Detect prepends/appends and maintain position.
  useLayoutEffect(() => {
    const scroller = containerRef.current;
    if (!scroller) {
      prevCountRef.current = itemIds.length;
      prevFirstRef.current = itemIds[0];
      prevLastRef.current = itemIds[itemIds.length - 1];
      return;
    }

    const countIncreased = itemIds.length > prevCountRef.current;
    const firstChanged = itemIds[0] !== prevFirstRef.current;
    const lastChanged = itemIds[itemIds.length - 1] !== prevLastRef.current;

    // If we prepended (added items above), keep viewport stable via scrollHeight diff
    if (countIncreased && firstChanged && !lastChanged) {
      const newScrollHeight = scroller.scrollHeight;
      const delta = newScrollHeight - prevScrollHeightRef.current;
      if (delta !== 0) {
        scroller.scrollTop = scroller.scrollTop + delta;
      }
    }

    // If we appended and we're following (or were near bottom), keep pinned
    if (countIncreased && lastChanged && shouldFollowRef.current) {
      // When following, show the entire new last item (not just bottom)
      const newLast = itemIds[itemIds.length - 1];
      scrollTurnIntoView(newLast);
    }

    // Snapshot for next cycle
    prevCountRef.current = itemIds.length;
    prevFirstRef.current = itemIds[0];
    prevLastRef.current = itemIds[itemIds.length - 1];
    prevScrollHeightRef.current = scroller.scrollHeight;
  }, [containerRef, itemIds, scrollTurnIntoView]);

  // Follow-to-bottom control around generation (draft) lifecycle.
  useLayoutEffect(() => {
    const was = wasGeneratingRef.current;
    const now = isGenerating;
    wasGeneratingRef.current = now;

    // Rising edge: generation started → follow iff user is near bottom.
    if (!was && now) {
      shouldFollowRef.current = isNearBottom();
      if (shouldFollowRef.current) {
        // Ensure the draft (sticky footer) is fully visible.
        scrollToBottom();
      }
    }

    // Falling edge: generation ended → if we were following, ensure the new turn is fully visible.
    if (was && !now && shouldFollowRef.current) {
      shouldFollowRef.current = false;
      // The new turn will typically be the last item; ensure it's fully visible.
      const lastId = itemIds[itemIds.length - 1];
      if (lastId != null) {
        scrollTurnIntoView(lastId);
      }
    }
  }, [isGenerating, isNearBottom, itemIds, scrollToBottom, scrollTurnIntoView]);

  return { topSentinelRef, scrollToBottom, scrollTurnIntoView };
}
