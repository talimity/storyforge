import { useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { showSuccessToast } from "@/lib/utils/error-handling";

export interface UseTurnActionsOptions {
  onTurnDeleted?: () => void;
  onTurnUpdated?: () => void;
}

export function useTurnActions(options: UseTurnActionsOptions = {}) {
  const { onTurnDeleted, onTurnUpdated } = options;

  const [turnToDelete, setTurnToDelete] = useState<{
    id: string;
    cascade: boolean;
  } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);

  const deleteTurnMutation = trpc.play.deleteTurn.useMutation({
    onSuccess: () => {
      showSuccessToast({
        title: "Turn deleted",
        description: "Turn deleted from the scenario timeline.",
      });
      onTurnDeleted?.();
      setShowDeleteDialog(false);
      setTurnToDelete(null);
    },
  });

  const updateTurnContentMutation = trpc.play.updateTurnContent.useMutation({
    onSuccess: () => {
      showSuccessToast({
        title: "Turn updated",
        description: "Changes saved.",
      });
      setEditingTurnId(null);
      onTurnUpdated?.();
    },
  });

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
      setEditingTurnId(turnId);
      updateTurnContentMutation.mutate({
        turnId,
        layer: "presentation",
        content,
      });
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
