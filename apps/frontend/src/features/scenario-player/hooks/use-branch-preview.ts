import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { useScenarioContext } from "../providers/scenario-provider";
import { selectIsGenerating, useIntentRunsStore } from "../stores/intent-run-store";
import { useScenarioPlayerStore } from "../stores/scenario-player-store";
import { useScenarioDataInvalidator } from "./use-scenario-data-invalidator";

export function useBranchPreview() {
  const { scenario } = useScenarioContext();
  const trpc = useTRPC();
  const { invalidateCore } = useScenarioDataInvalidator();

  const isGenerating = useIntentRunsStore(selectIsGenerating);
  const previewLeafTurnId = useScenarioPlayerStore((s) => s.previewLeafTurnId);
  const setPreviewLeaf = useScenarioPlayerStore((s) => s.setPreviewLeaf);
  const setPendingScrollTarget = useScenarioPlayerStore((s) => s.setPendingScrollTarget);
  const requestRecommendedSelection = useScenarioPlayerStore((s) => s.requestRecommendedSelection);

  const resolveLeaf = useMutation(trpc.timeline.resolveLeaf.mutationOptions());
  const switchTimeline = useMutation(trpc.timeline.switchTimeline.mutationOptions());

  const scenarioId = scenario.id;
  const anchorTurnId = scenario.anchorTurnId;

  const commitSwitch = async (leafTurnId: string) => {
    await switchTimeline.mutateAsync({ scenarioId, leafTurnId });
    await invalidateCore();
    // clear preview after cache invalidation to avoid flicker
    setPreviewLeaf(null);
    requestRecommendedSelection();
  };

  const previewSibling = async (siblingId: string | null | undefined, currentTurnId: string) => {
    if (isGenerating || !siblingId) return;

    const { leafTurnId: siblingLeafId } = await resolveLeaf.mutateAsync({
      scenarioId,
      fromTurnId: siblingId,
    });
    const siblingIsLeaf = siblingLeafId === siblingId;

    // 1. If the preview target is the same as the anchor, we are trying to
    //    "preview" the active timeline and can just exit preview mode.
    if (anchorTurnId && siblingLeafId === anchorTurnId) {
      setPreviewLeaf(null);
    }
    // 2. If the user is at the bottom of the current timeline and switching
    //    between siblings that are also leaf nodes, we skip previewing since
    //    the tree does not go any deeper and the user is likely choosing an
    //    alternative generation.
    else if (!previewLeafTurnId && siblingIsLeaf && currentTurnId === anchorTurnId) {
      await commitSwitch(siblingLeafId);
    }
    // 3. Otherwise, we enter preview mode for the sibling's leaf turn.
    else {
      setPreviewLeaf(siblingLeafId);
    }

    requestAnimationFrame(() =>
      setPendingScrollTarget({ kind: "turn", turnId: siblingId, edge: "end" })
    );
  };

  const previewTurn = async (turnId: string) => {
    if (isGenerating) return;

    const { leafTurnId } = await resolveLeaf.mutateAsync({
      scenarioId,
      fromTurnId: turnId,
    });

    setPendingScrollTarget({ kind: "turn", turnId, edge: "center", skipIfVisible: true });

    if (anchorTurnId && leafTurnId === anchorTurnId) {
      setPreviewLeaf(null);
    } else {
      setPreviewLeaf(leafTurnId);
    }
  };

  const commitPreview = async () => {
    if (!previewLeafTurnId) return;
    await commitSwitch(previewLeafTurnId);
  };

  const exitPreview = () => {
    setPreviewLeaf(null);
  };

  return {
    isGenerating,
    isPreviewing: Boolean(previewLeafTurnId),
    previewLeafTurnId,
    previewSibling,
    previewTurn,
    commitPreview,
    exitPreview,
  };
}
