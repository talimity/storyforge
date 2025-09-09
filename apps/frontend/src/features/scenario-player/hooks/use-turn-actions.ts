import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
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

  const [turnToDelete, setTurnToDelete] = useState<{
    id: string;
    cascade: boolean;
  } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const editingTurnId = useScenarioPlayerStore((state) => state.editingTurnId);
  const setEditingTurnId = useScenarioPlayerStore((state) => state.setEditingTurnId);

  const deleteTurnMutation = useMutation(
    trpc.play.deleteTurn.mutationOptions({
      onSuccess: () => {
        showSuccessToast({
          title: "Turn deleted",
          description: "Turn deleted from the scenario timeline.",
        });
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

    // Edit handlers
    handleEditTurn,
  };
}
