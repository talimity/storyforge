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

  const isGenerating = useIntentRunsStore(selectIsGenerating);
  const previewLeafTurnId = useScenarioPlayerStore((s) => s.previewLeafTurnId);
  const setPreviewLeaf = useScenarioPlayerStore((s) => s.setPreviewLeaf);
  const setPendingScrollTarget = useScenarioPlayerStore((s) => s.setPendingScrollTarget);

  const resolveLeaf = useMutation(trpc.timeline.resolveLeaf.mutationOptions());
  const switchTimeline = useMutation(trpc.timeline.switchTimeline.mutationOptions());

  const commitSwitch = useCallback(
    async (leafTurnId: string) => {
      await switchTimeline.mutateAsync({ scenarioId: scenario.id, leafTurnId });
      await Promise.all([
        qc.invalidateQueries(trpc.timeline.window.pathFilter()),
        qc.invalidateQueries(trpc.timeline.state.pathFilter()),
        qc.invalidateQueries(trpc.scenarios.playEnvironment.pathFilter()),
      ]);
      setPreviewLeaf(null); // do this after invalidate resolves to avoid flickering
    },
    [switchTimeline, scenario.id, qc, trpc, setPreviewLeaf]
  );

  const previewSibling = useCallback(
    async (siblingId: string | null | undefined, currentTurnId: string) => {
      if (isGenerating || !siblingId) return;

      const { leafTurnId: siblingLeafId } = await resolveLeaf.mutateAsync({
        scenarioId: scenario.id,
        fromTurnId: siblingId,
      });
      const siblingIsLeaf = siblingLeafId === siblingId;

      // If the target leaf is the same as the anchor, we are 'previewing' the
      // active timeline, so exit preview.
      const anchor = scenario.anchorTurnId ?? null;
      if (siblingLeafId && anchor && siblingLeafId === anchor) {
        setPreviewLeaf(null);
      }
      // Skip preview and switch immediately if the user is swiping through
      // several leaf nodes of equal depth at the bottom of the active timeline.
      else if (!previewLeafTurnId && siblingIsLeaf && currentTurnId === scenario.anchorTurnId) {
        await commitSwitch(siblingLeafId);
      }
      // Preview the resolved leaf
      else {
        setPreviewLeaf(siblingLeafId && anchor && siblingLeafId === anchor ? null : siblingLeafId);
      }

      requestAnimationFrame(() =>
        setPendingScrollTarget({ kind: "turn", turnId: siblingId, edge: "end" })
      );
    },
    [
      isGenerating,
      resolveLeaf,
      scenario.id,
      scenario.anchorTurnId,
      previewLeafTurnId,
      commitSwitch,
      setPreviewLeaf,
      setPendingScrollTarget,
    ]
  );

  const previewTurn = useCallback(
    async (turnId: string) => {
      if (isGenerating) return;

      const { leafTurnId } = await resolveLeaf.mutateAsync({
        scenarioId: scenario.id,
        fromTurnId: turnId,
      });

      setPendingScrollTarget({ kind: "turn", turnId, edge: "center", skipIfVisible: true });

      const anchor = scenario.anchorTurnId ?? null;
      if (leafTurnId && anchor && leafTurnId === anchor) {
        setPreviewLeaf(null);
      } else {
        setPreviewLeaf(leafTurnId ?? null);
      }
    },
    [
      isGenerating,
      resolveLeaf,
      scenario.id,
      scenario.anchorTurnId,
      setPendingScrollTarget,
      setPreviewLeaf,
    ]
  );

  const commitPreview = useCallback(async () => {
    if (!previewLeafTurnId) return;
    await commitSwitch(previewLeafTurnId);
  }, [previewLeafTurnId, commitSwitch]);

  const exitPreview = useCallback(() => setPreviewLeaf(null), [setPreviewLeaf]);

  return useMemo(
    () => ({
      isGenerating,
      isPreviewing: Boolean(previewLeafTurnId),
      previewLeafTurnId,
      previewSibling,
      previewTurn,
      commitPreview,
      exitPreview,
    }),
    [isGenerating, previewLeafTurnId, previewSibling, previewTurn, commitPreview, exitPreview]
  );
}
