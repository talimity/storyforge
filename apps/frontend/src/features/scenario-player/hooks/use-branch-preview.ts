// apps/frontend/src/features/scenario-player/hooks/use-branch-preview.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useTRPC } from "@/lib/trpc";
import { useScenarioContext } from "../providers/scenario-provider";
import { selectIsGenerating, useIntentRunsStore } from "../stores/intent-run-store";
import { useScenarioPlayerStore } from "../stores/scenario-player-store";

export function useBranchPreview() {
  const { scenario } = useScenarioContext();
  const trpc = useTRPC();
  const qc = useQueryClient();

  const previewLeafTurnId = useScenarioPlayerStore((s) => s.previewLeafTurnId);
  const setPreviewLeaf = useScenarioPlayerStore((s) => s.setPreviewLeaf);
  const isGenerating = useIntentRunsStore(selectIsGenerating);

  const resolveLeaf = useMutation(trpc.play.resolveLeaf.mutationOptions());
  const switchTimeline = useMutation(trpc.play.switchTimeline.mutationOptions());

  const previewSibling = useCallback(
    async (siblingId: string | null | undefined) => {
      if (isGenerating || !siblingId) return;
      const { leafTurnId } = await resolveLeaf.mutateAsync({
        scenarioId: scenario.id,
        fromTurnId: siblingId,
      });
      // If the resolved leaf equals the current anchor, we are effectively on the active timeline
      // so clear preview; otherwise set preview to that leaf.
      const anchor = scenario.anchorTurnId ?? null;
      setPreviewLeaf(leafTurnId && anchor && leafTurnId === anchor ? null : leafTurnId);
    },
    [isGenerating, resolveLeaf, scenario.id, scenario.anchorTurnId, setPreviewLeaf]
  );

  const commitPreview = useCallback(async () => {
    if (!previewLeafTurnId) return;
    await switchTimeline.mutateAsync({ scenarioId: scenario.id, leafTurnId: previewLeafTurnId });
    await qc.invalidateQueries(trpc.play.timeline.pathFilter());
    await qc.invalidateQueries(trpc.play.environment.pathFilter());
    setPreviewLeaf(null); // do this after invalidate resolves to avoid flickering
  }, [previewLeafTurnId, switchTimeline, scenario.id, setPreviewLeaf, qc, trpc]);

  const exitPreview = useCallback(() => setPreviewLeaf(null), [setPreviewLeaf]);

  return useMemo(
    () => ({
      isGenerating,
      isPreviewing: Boolean(previewLeafTurnId),
      previewLeafTurnId,
      previewSibling,
      commitPreview,
      exitPreview,
    }),
    [isGenerating, previewLeafTurnId, previewSibling, commitPreview, exitPreview]
  );
}
