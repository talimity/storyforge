import type { Virtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useRef } from "react";
import { useScenarioPlayerStore } from "../stores/scenario-player-store";

const MAX_RAF = 6;
const BOTTOM_EPSILON = 2;

export function useInitialScroll<TScrollEl extends Element | Window, TItemEl extends Element>({
  virtualizer,
  scrollerRef,
  turns,
}: {
  virtualizer: Virtualizer<TScrollEl, TItemEl>;
  scrollerRef: React.RefObject<HTMLElement | null>;
  turns: unknown[];
}) {
  const setPendingScrollTarget = useScenarioPlayerStore((s) => s.setPendingScrollTarget);
  const initialScrolledRef = useRef(false);

  useLayoutEffect(() => {
    if (turns.length <= 1) return;
    if (initialScrolledRef.current) return;

    let cancelled = false;
    let tries = 0;

    const tryScrollToBottom = () => {
      if (cancelled) return;

      // Ask virtualizer to go to the last row
      const count = virtualizer.options.count;
      virtualizer.scrollToIndex(count - 1, { align: "end", behavior: "auto" });

      requestAnimationFrame(() => {
        const sc = scrollerRef.current;
        const total = virtualizer.getTotalSize();
        const offset = virtualizer.scrollOffset ?? sc?.scrollTop ?? 0;
        const viewport = sc?.clientHeight ?? 0;
        const atBottom = offset + viewport >= total - BOTTOM_EPSILON;

        if (!atBottom && tries++ < MAX_RAF) {
          tryScrollToBottom();
        } else {
          // Seed the anchor so other systems see "we are following bottom"
          setPendingScrollTarget({ kind: "bottom" });
          setTimeout(() => {
            initialScrolledRef.current = true;
          }, 500);
        }
      });
    };

    tryScrollToBottom();
    return () => {
      cancelled = true;
    };
  }, [virtualizer, scrollerRef, turns.length, setPendingScrollTarget]);

  return { pendingInitialScroll: !initialScrolledRef.current };
}
