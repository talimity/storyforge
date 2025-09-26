import { useEffect, useRef } from "react";
import {
  type IntentRunsState,
  selectIsGenerating,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";

// primitive tick that changes on each streaming token
const selectDraftTick = (s: IntentRunsState) => {
  const id = s.currentRunId;
  if (!id) return 0;
  const r = s.runsById[id];
  if (!r) return 0;
  return r.livePreview.length;
};

export function AutoFollowOnDraft() {
  const isGenerating = useIntentRunsStore(selectIsGenerating);
  const tick = useIntentRunsStore(selectDraftTick);
  const shouldAutoFollow = useScenarioPlayerStore((s) => s.shouldAutoFollow);
  const setPendingScrollTarget = useScenarioPlayerStore((s) => s.setPendingScrollTarget);
  const lastTickRef = useRef(tick);
  const throttleUntilRef = useRef(0);

  useEffect(() => {
    if (!isGenerating) return;
    if (tick === lastTickRef.current) return;
    lastTickRef.current = tick;
    if (!shouldAutoFollow() || Date.now() < throttleUntilRef.current) return;
    throttleUntilRef.current = Date.now() + 100;
    setPendingScrollTarget({ kind: "bottom" });
  }, [isGenerating, tick, setPendingScrollTarget, shouldAutoFollow]);

  return null;
}
