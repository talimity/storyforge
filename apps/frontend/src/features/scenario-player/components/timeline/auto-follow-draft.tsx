import { useEffect, useRef } from "react";
import { useTimelineScroll } from "@/features/scenario-player/providers/timeline-scroll-provider";
import {
  type IntentRunsState,
  selectIsGenerating,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";

// primitive tick that changes on each streaming token
const selectDraftTick = (s: IntentRunsState) => {
  const id = s.currentRunId;
  if (!id) return 0;
  const r = s.runsById[id];
  if (!r) return 0;
  return r.livePreview.length;
};

export function AutoFollowOnDraft() {
  const { scrollToEnd, shouldAutoFollow } = useTimelineScroll();
  const isGenerating = useIntentRunsStore(selectIsGenerating);
  const tick = useIntentRunsStore(selectDraftTick);
  const lastTickRef = useRef(tick);
  const throttleUntilRef = useRef(0);

  useEffect(() => {
    if (!isGenerating) return;
    if (tick === lastTickRef.current) return;
    lastTickRef.current = tick;
    if (!shouldAutoFollow() || Date.now() < throttleUntilRef.current) return;
    throttleUntilRef.current = Date.now() + 100;
    scrollToEnd();
  }, [isGenerating, tick, scrollToEnd, shouldAutoFollow]);

  return null;
}
