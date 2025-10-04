import type { Virtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef } from "react";
import {
  selectIsGenerating,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";

const AT_BOTTOM_TOLERANCE_PX = 5;
const QUIET_MS = 400;

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
  const setShouldAutoFollow = useScenarioPlayerStore((s) => s.setShouldAutoFollow);
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
    console.log("useTimelineFollowOutputMode -> run status change, state", stateRef.current);
  }, [isGenerating, atBottom]);

  // Detect scroll adjustments to pause or resume following during a run.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onUserScrollStart = () => {
      if (!isGenerating) return;

      const now = Date.now();
      const isAtBottom = atBottom();

      console.log("useTimelineFollowOutputMode -> onUserScrollStart", {
        state: stateRef.current,
        isAtBottom,
        now,
      });

      if (stateRef.current === "suspended" && isAtBottom && now >= suspendUntilRef.current) {
        console.log("useTimelineFollowOutputMode -> onScroll -> resume following");
        stateRef.current = "following";
        suspendUntilRef.current = 0;
      }

      if (stateRef.current === "following") {
        console.log("useTimelineFollowOutputMode -> onScroll -> suspend following");
        stateRef.current = "suspended";
        suspendUntilRef.current = Date.now() + QUIET_MS;
      }
    };
    const onUserKeyboardScroll = (e: KeyboardEvent) => {
      if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "].includes(e.key))
        onUserScrollStart();
    };

    el.addEventListener("wheel", onUserScrollStart, { passive: true });
    el.addEventListener("touchend", onUserScrollStart, { passive: true });
    window.addEventListener("keydown", onUserKeyboardScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onUserScrollStart);
      el.removeEventListener("touchend", onUserScrollStart);
      window.removeEventListener("keydown", onUserKeyboardScroll);
    };
  }, [isGenerating, atBottom, scrollerRef]);

  // callers can gate "jump to bottom on new content" with this check
  const shouldAutoFollow = useCallback(() => {
    if (!isGenerating) return false;

    if (stateRef.current === "suspended") {
      const now = Date.now();
      const isAtBottom = atBottom();
      if (now >= suspendUntilRef.current && isAtBottom) {
        console.log("useTimelineFollowOutputMode -> shouldAutoFollow -> resume following");
        stateRef.current = "following";
        suspendUntilRef.current = 0;
        return true;
      }
      return false;
    }

    return stateRef.current === "following";
  }, [isGenerating, atBottom]);

  useEffect(() => {
    setShouldAutoFollow(shouldAutoFollow);
  }, [setShouldAutoFollow, shouldAutoFollow]);
}
