import type { IntentInput, TimelineTurn } from "@storyforge/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useScenarioIntentActions } from "@/features/scenario-player/hooks/use-scenario-intent-actions";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import {
  selectIsGenerating,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

export function useTurnActions() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { scenario } = useScenarioContext();
  const [turnToDelete, setTurnToDelete] = useState<{ id: string; cascade: boolean } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [retryTurn, setRetryTurn] = useState<TimelineTurn | null>(null);
  const [manualTurnTarget, setManualTurnTarget] = useState<TimelineTurn | null>(null);
  const editingTurnId = useScenarioPlayerStore((state) => state.editingTurnId);
  const setEditingTurnId = useScenarioPlayerStore((state) => state.setEditingTurnId);
  const startRun = useIntentRunsStore((s) => s.startRun);
  const isGenerating = useIntentRunsStore(selectIsGenerating);
  const { createIntent, insertTurnAfter, isCreatingIntent, isInsertingTurnAfter } =
    useScenarioIntentActions();
  const { mutate: deleteTurn, isPending: isDeleting } = useMutation(
    trpc.timeline.deleteTurn.mutationOptions({
      onSuccess: () => {
        showSuccessToast({
          title: "Turn deleted",
          description: "Turn deleted from the scenario timeline.",
        });
        // Anchor may have changed; ensure we reload environment and reset timeline slices
        qc.invalidateQueries(trpc.scenarios.playEnvironment.pathFilter());
        qc.invalidateQueries(trpc.timeline.window.pathFilter());
        qc.invalidateQueries(trpc.timeline.state.pathFilter());
        setShowDeleteDialog(false);
        setTurnToDelete(null);
      },
    })
  );
  const { mutate: editTurn, isPending: isUpdating } = useMutation(
    trpc.timeline.updateTurnContent.mutationOptions({
      onSuccess: () => {
        showSuccessToast({ title: "Turn updated", description: "Changes saved." });
        qc.invalidateQueries(trpc.timeline.window.pathFilter());
        setEditingTurnId(null);
      },
    })
  );

  const handleDeleteTurn = useCallback((turnId: string, cascade: boolean) => {
    setTurnToDelete({ id: turnId, cascade });
    setShowDeleteDialog(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (turnToDelete) {
      deleteTurn({ turnId: turnToDelete.id, cascade: turnToDelete.cascade });
    }
  }, [turnToDelete, deleteTurn]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteDialog(false);
    setTurnToDelete(null);
  }, []);

  const handleEditTurn = useCallback(
    async (turnId: string, content: string) => editTurn({ turnId, content }),
    [editTurn]
  );

  const handleRetryTurn = useCallback(
    (turn: TimelineTurn) => {
      if (isGenerating || !turn.parentTurnId) return;
      setRetryTurn(turn);
    },
    [isGenerating]
  );

  const handleInsertManualTurn = useCallback(
    (turn: TimelineTurn) => {
      if (isGenerating) return;
      setManualTurnTarget(turn);
    },
    [isGenerating]
  );

  const handleRetrySubmit = useCallback(
    async (input: IntentInput) => {
      if (!retryTurn || !retryTurn.parentTurnId) return;
      const { intentId } = await createIntent({
        scenarioId: scenario.id,
        parameters: input,
        branchFrom: { kind: "turn_parent", targetId: retryTurn.id },
      });
      startRun({ intentId, scenarioId: scenario.id, kind: input.kind });
      setRetryTurn(null);
    },
    [createIntent, retryTurn, scenario.id, startRun]
  );

  const handleRetryClose = useCallback(() => {
    setRetryTurn(null);
  }, []);

  const handleManualInsertSubmit = useCallback(
    async (input: { authorParticipantId: string; text: string }) => {
      if (!manualTurnTarget) return;
      await insertTurnAfter({
        scenarioId: scenario.id,
        targetTurnId: manualTurnTarget.id,
        authorParticipantId: input.authorParticipantId,
        text: input.text,
      });
      showSuccessToast({
        title: "Turn inserted",
        description: "Manual turn added to the timeline.",
      });
      setManualTurnTarget(null);
    },
    [insertTurnAfter, manualTurnTarget, scenario.id]
  );

  const handleManualInsertClose = useCallback(() => {
    setManualTurnTarget(null);
  }, []);

  return {
    // Delete state
    turnToDelete,
    showDeleteDialog,
    isDeleting,

    // Retry state
    retryTurn,
    isRetrying: isCreatingIntent,

    // Manual insert state
    manualTurnTarget,
    isInsertingManualTurn: isInsertingTurnAfter,

    // Edit state
    editingTurnId,
    isUpdating,

    // Delete handlers
    handleDeleteTurn,
    handleConfirmDelete,
    handleCancelDelete,

    // Edit handler
    handleEditTurn,

    // Retry handler
    handleRetryTurn,
    handleRetrySubmit,
    handleRetryClose,

    // Manual insert handlers
    handleInsertManualTurn,
    handleManualInsertSubmit,
    handleManualInsertClose,
  };
}
