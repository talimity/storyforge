import type { Virtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useRef } from "react";
import { useTimelineFollowOutputMode } from "@/features/scenario-player/hooks/use-timeline-follow-output-mode";
import {
  selectCurrentRun,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";

type Args<TScrollEl extends Element | Window, TItemEl extends Element> = {
  virtualizer: Virtualizer<TScrollEl, TItemEl>;
  turns: { id: string }[];
  scrollerRef: React.RefObject<HTMLElement | null>;
};

export function useTimelineFollowOutput<
  TScrollEl extends Element | Window,
  TItemEl extends Element,
>({ virtualizer, scrollerRef, turns }: Args<TScrollEl, TItemEl>) {
  const { shouldAutoFollow } = useTimelineFollowOutputMode({ virtualizer, scrollerRef });
  const currentRun = useIntentRunsStore(selectCurrentRun);
  const newContentKey = String(turns.at(-1)?.id) + String(currentRun?.provisional?.at(0)?.text);
  const lastNewContentRef = useRef(newContentKey);

  useLayoutEffect(() => {
    if (newContentKey === lastNewContentRef.current) return;
    lastNewContentRef.current = newContentKey;

    if (!shouldAutoFollow()) return;
    const count = virtualizer.options.count;
    virtualizer.scrollToIndex(count - 1, { align: "end" });
  }, [virtualizer, newContentKey, shouldAutoFollow]);
}
