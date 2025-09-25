import type { Virtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef } from "react";
import {
  selectIsGenerating,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";

const AT_BOTTOM_TOLERANCE_PX = 10;
const TEMPORARY_SUSPEND_MS = 500;

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
 * - If user scrolls away during run => suspend briefly to allow navigation.
 * - After suspension window, reaching the bottom resumes following.
 * - Next run re-evaluates at-bottom to decide again.
 */
export function useTimelineFollowOutputMode<
  TScrollEl extends Element | Window,
  TItemEl extends Element,
>({ virtualizer, scrollerRef }: Args<TScrollEl, TItemEl>) {
  const isGenerating = useIntentRunsStore(selectIsGenerating);
  const stateRef = useRef<"idle" | "following" | "suspended">("idle");
  const suspendUntilRef = useRef<number>(0);

  // Determines whether the user is at the bottom of the timeline.
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
      suspendUntilRef.current = 0;
      return;
    }

    stateRef.current = atBottom() ? "following" : "suspended";
    suspendUntilRef.current = 0;
  }, [isGenerating, atBottom]);

  // Detect scroll adjustments to pause or resume following during a run.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      if (!isGenerating) return;

      const now = Date.now();
      const isAtBottom = atBottom();

      console.log("useTimelineFollowOutputMode -> onScroll", {
        isAtBottom,
        state: stateRef.current,
      });

      if (stateRef.current === "following" && !isAtBottom) {
        stateRef.current = "suspended";
        suspendUntilRef.current = now + TEMPORARY_SUSPEND_MS;
        return;
      }

      if (stateRef.current === "suspended" && isAtBottom && now >= suspendUntilRef.current) {
        stateRef.current = "following";
        suspendUntilRef.current = 0;
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isGenerating, atBottom, scrollerRef]);

  // callers can gate "jump to bottom on new content" with this check
  const shouldAutoFollow = useCallback(() => {
    if (!isGenerating) return false;

    if (stateRef.current === "suspended") {
      const now = Date.now();
      const isAtBottom = atBottom();
      if (now >= suspendUntilRef.current && isAtBottom) {
        stateRef.current = "following";
        suspendUntilRef.current = 0;
        return true;
      }
      return false;
    }

    return stateRef.current === "following";
  }, [isGenerating, atBottom]);

  return { shouldAutoFollow, atBottom };
}
