import type { Virtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef } from "react";
import {
  selectIsGenerating,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";

const AT_BOTTOM_TOLERANCE_PX = 30;

type Args<TScrollEl extends Element | Window, TItemEl extends Element> = {
  virtualizer: Virtualizer<TScrollEl, TItemEl>;
  scrollerRef: React.RefObject<HTMLElement | null>;
};

/**
 * Monitors the current run and user scroll behavior to determine whether
 * the timeline should automatically follow the output of a generation by
 * scrolling to the bottom.
 *
 * Auto-follow policy:
 * - On run start: if user is at bottom => "following"; else "suspended".
 * - If user scrolls away during run => lock "suspended" until run ends.
 * - Next run re-evaluates at-bottom to decide again.
 */
export function useTimelineFollowOutputMode<
  TScrollEl extends Element | Window,
  TItemEl extends Element,
>({ virtualizer, scrollerRef }: Args<TScrollEl, TItemEl>) {
  const runId = useIntentRunsStore((s) => s.currentRunId);
  const isGenerating = useIntentRunsStore(selectIsGenerating);

  const stateRef = useRef<"idle" | "following" | "suspended">("idle");
  const lastRunIdRef = useRef<string | null>(null);

  const atBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return true;

    const total = virtualizer.getTotalSize();
    // prefer the virtualizer's offset; fallback to DOM if needed
    const offset = virtualizer.scrollOffset ?? el.scrollTop;
    const viewport = el.clientHeight;
    return offset + viewport >= total - AT_BOTTOM_TOLERANCE_PX;
  }, [virtualizer, scrollerRef]);

  // When a run starts/changes, decide initial follow mode.
  useEffect(() => {
    if (!isGenerating) {
      stateRef.current = "idle";
      return;
    }

    if (lastRunIdRef.current !== runId) {
      lastRunIdRef.current = runId;
      stateRef.current = atBottom() ? "following" : "suspended";
    }
  }, [runId, isGenerating, atBottom]);

  // If user scrolls away during this run, suspend until the run changes.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      if (isGenerating && stateRef.current === "following" && !atBottom()) {
        stateRef.current = "suspended"; // stay suspended until next run
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isGenerating, atBottom, scrollerRef]);

  // callers can gate "jump to bottom on new content" with this check
  const shouldAutoFollow = useCallback(
    () => isGenerating && stateRef.current === "following",
    [isGenerating]
  );

  return { shouldAutoFollow, atBottom };
}
