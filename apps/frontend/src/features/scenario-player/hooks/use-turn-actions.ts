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

export interface UseTurnActionsOptions {
  onTurnDeleted?: () => void;
  onTurnUpdated?: () => void;
}

export function useTurnActions(options: UseTurnActionsOptions = {}) {
  const trpc = useTRPC();
  const { onTurnDeleted, onTurnUpdated } = options;
  const qc = useQueryClient();

  const [turnToDelete, setTurnToDelete] = useState<{
    id: string;
    cascade: boolean;
  } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { scenario } = useScenarioContext();
  const editingTurnId = useScenarioPlayerStore((state) => state.editingTurnId);
  const setEditingTurnId = useScenarioPlayerStore((state) => state.setEditingTurnId);
  const startRun = useIntentRunsStore((s) => s.startRun);
  const isGenerating = useIntentRunsStore(selectIsGenerating);
  const { createIntent } = useScenarioIntentActions();

  const deleteTurnMutation = useMutation(
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

  const updateTurnContentMutation = useMutation(
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
      deleteTurnMutation.mutate({
        turnId: turnToDelete.id,
        cascade: turnToDelete.cascade,
      });
    }
  }, [turnToDelete, deleteTurnMutation]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteDialog(false);
    setTurnToDelete(null);
  }, []);

  const handleEditTurn = useCallback(
    (turnId: string, content: string) => {
      updateTurnContentMutation.mutate({ turnId, layer: "presentation", content });
    },
    [updateTurnContentMutation]
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
    [isGenerating, scenario.id, createIntent, startRun]
  );

  return {
    // Delete state
    turnToDelete,
    showDeleteDialog,
    isDeleting: deleteTurnMutation.isPending,

    // Edit state
    editingTurnId,
    isUpdating: updateTurnContentMutation.isPending,

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
