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

interface UseTurnActionsOptions {
  onTurnDeleted?: () => void;
  onTurnUpdated?: () => void;
}

export function useTurnActions(options: UseTurnActionsOptions = {}) {
  const trpc = useTRPC();
  const { onTurnDeleted, onTurnUpdated } = options;
  const qc = useQueryClient();
  const { scenario } = useScenarioContext();
  const [turnToDelete, setTurnToDelete] = useState<{ id: string; cascade: boolean } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const editingTurnId = useScenarioPlayerStore((state) => state.editingTurnId);
  const setEditingTurnId = useScenarioPlayerStore((state) => state.setEditingTurnId);
  const startRun = useIntentRunsStore((s) => s.startRun);
  const isGenerating = useIntentRunsStore(selectIsGenerating);
  const { createIntent } = useScenarioIntentActions();
  const { mutate: deleteTurn, isPending: isDeleting } = useMutation(
    trpc.play.deleteTurn.mutationOptions({
      onSuccess: () => {
        showSuccessToast({
          title: "Turn deleted",
          description: "Turn deleted from the scenario timeline.",
        });
        // Anchor may have changed; ensure we reload environment and reset timeline slices
        qc.invalidateQueries(trpc.play.environment.pathFilter());
        qc.invalidateQueries(trpc.play.timeline.pathFilter());
        onTurnDeleted?.();
        setShowDeleteDialog(false);
        setTurnToDelete(null);
      },
    })
  );
  const { mutate: editTurn, isPending: isUpdating } = useMutation(
    trpc.play.updateTurnContent.mutationOptions({
      onSuccess: () => {
        showSuccessToast({ title: "Turn updated", description: "Changes saved." });
        setEditingTurnId(null);
        onTurnUpdated?.();
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
    async (turnId: string, parentTurnId: string | null) => {
      if (isGenerating || !parentTurnId) return;
      const { intentId } = await createIntent({
        scenarioId: scenario.id,
        parameters: { kind: "continue_story" },
        branchFrom: { kind: "turn_parent", targetId: turnId },
      });
      startRun({ intentId, scenarioId: scenario.id, kind: "continue_story" });
    },
    [isGenerating, createIntent, scenario.id, startRun]
  );

  return {
    // Delete state
    turnToDelete,
    showDeleteDialog,
    isDeleting,

    // Edit state
    editingTurnId,
    isUpdating,

    // Delete handlers
    handleDeleteTurn,
    handleConfirmDelete,
    handleCancelDelete,
    setShowDeleteDialog,

    // Edit handler
    handleEditTurn,

    // Retry handler
    handleRetryTurn,
  };
}
