import type { Virtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useRef } from "react";
import { useScenarioPlayerStore } from "../stores/scenario-player-store";

const MAX_RAF = 6;
const BOTTOM_EPSILON = 2;

const raf = (cb: () => void) => requestAnimationFrame(() => cb());

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
    if (initialScrolledRef.current) return;
    if (turns.length <= 1) return;

    let cancelled = false;
    let tries = 0;

    const tryScrollToBottom = () => {
      if (cancelled) return;

      raf(() => {
        setPendingScrollTarget({ kind: "bottom" });

        const sc = scrollerRef.current;
        const total = virtualizer.getTotalSize();
        const offset = virtualizer.scrollOffset ?? sc?.scrollTop ?? 0;
        const viewport = sc?.clientHeight ?? 0;
        const atBottom = offset + viewport >= total - BOTTOM_EPSILON;

        if (!atBottom && tries++ < MAX_RAF) {
          tryScrollToBottom();
          console.log(`useInitialScroll: tryScrollToBottom attempt ${tries}`);
        } else {
          initialScrolledRef.current = true;
          console.log("useInitialScroll: initial scroll to bottom complete");
        }
      });
    };

    console.log("useInitialScroll: starting initial scroll to bottom", {
      cancelled,
      tries,
      turnsLength: turns.length,
    });

    raf(() => {
      if (!cancelled) {
        tryScrollToBottom();
      }
    });
    return () => {
      console.log("useInitialScroll: cancelling initial scroll to bottom");
      cancelled = true;
    };
  }, [virtualizer, scrollerRef, turns.length, setPendingScrollTarget]);

  return { pendingInitialScroll: !initialScrolledRef.current };
}
