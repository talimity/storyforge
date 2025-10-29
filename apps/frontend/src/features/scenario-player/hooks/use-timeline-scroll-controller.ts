import { assertNever } from "@storyforge/utils";
import type { Virtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect } from "react";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";

type Args<TScrollEl extends Element | Window, TItemEl extends Element> = {
  virtualizer: Virtualizer<TScrollEl, TItemEl>;
  scrollerRef: React.RefObject<HTMLElement | null>;
  visibleTurns: { id: string }[];
  isFetching?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => Promise<unknown>;
};

export function useTimelineScrollController<
  TScrollEl extends Element | Window,
  TItemEl extends Element,
>({
  virtualizer: v,
  scrollerRef,
  visibleTurns,
  isFetching,
  hasNextPage,
  onLoadMore,
}: Args<TScrollEl, TItemEl>) {
  const pendingScrollTarget = useScenarioPlayerStore((s) => s.pendingScrollTarget);
  const setPendingScrollTarget = useScenarioPlayerStore((s) => s.setPendingScrollTarget);

  // Ensure the scroll target is in the loaded set of turns
  useEffect(() => {
    const focusTurnId = pendingScrollTarget?.kind === "turn" ? pendingScrollTarget.turnId : null;
    if (!focusTurnId) return; // nothing to do
    if (isFetching || visibleTurns.some((t) => t.id === focusTurnId)) return; // found or awaiting data

    if (hasNextPage && onLoadMore) {
      // Cannot find the focus turn, but we have more data to load.
      void onLoadMore();
      console.info(
        "useTimelineScrollController: querying next page to find focus turn",
        focusTurnId,
        visibleTurns.length
      );
    }
  }, [isFetching, pendingScrollTarget, visibleTurns, hasNextPage, onLoadMore]);

  // Seek to the scroll target if one is requested
  useLayoutEffect(() => {
    if (!pendingScrollTarget || !scrollerRef.current) return;

    console.debug("useTimelineScrollController: seek to scroll target", pendingScrollTarget);

    switch (pendingScrollTarget.kind) {
      case "bottom":
        v.scrollBy(Number.MAX_SAFE_INTEGER, { align: "end", behavior: "auto" });
        setPendingScrollTarget(null);
        return;
      case "turn": {
        const focusTurnId = pendingScrollTarget.turnId;
        const focusTurnIndex = visibleTurns.findIndex((i) => i.id === focusTurnId);
        // Requested target isn't loaded yet so we have to wait for next data
        if (focusTurnIndex === -1) {
          console.warn(
            "useTimelineScrollController: focus turn is not yet loaded, waiting",
            focusTurnId
          );
          return;
        }
        const turnVirtualIndex = focusTurnIndex + 1; // +1 to account for header

        // Wait one frame to hopefully avoid a race condition with the
        // virtualizer and let it measure new items before attempting to scroll
        // to them.
        requestAnimationFrame(() => {
          const scrollerEl = scrollerRef.current;
          if (scrollerEl && pendingScrollTarget.skipIfVisible) {
            const fullyVisible = isTurnFullyVisible(scrollerEl, focusTurnId);
            if (fullyVisible) {
              setPendingScrollTarget(null);
              console.debug(
                "useTimelineScrollController: skipped scroll, turn already visible",
                focusTurnId
              );
              return;
            }
          }

          v.scrollToIndex(turnVirtualIndex, { align: pendingScrollTarget.edge, behavior: "auto" });
          setPendingScrollTarget(null);
          console.debug(
            "useTimelineScrollController: scrolled to target turn",
            focusTurnId,
            turnVirtualIndex
          );
        });
        return;
      }
      default:
        assertNever(pendingScrollTarget);
    }
  }, [pendingScrollTarget, setPendingScrollTarget, v, visibleTurns, scrollerRef.current]);
}

const VISIBILITY_EPSILON = 2;

function isTurnFullyVisible(scroller: Element, turnId: string) {
  if (!(scroller instanceof Element)) return false;
  const selector = `[data-turn-id="${escapeAttributeSelectorValue(turnId)}"]`;
  const target = scroller.querySelector<HTMLElement>(selector);
  if (!target) return false;

  const scrollerRect = scroller.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  const withinTop = targetRect.top >= scrollerRect.top + VISIBILITY_EPSILON;
  const withinBottom = targetRect.bottom <= scrollerRect.bottom - VISIBILITY_EPSILON;
  return withinTop && withinBottom;
}

function escapeAttributeSelectorValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
