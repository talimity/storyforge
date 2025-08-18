import { useCallback, useState } from "react";
import { toaster } from "@/components/ui/toaster";
import { trpc } from "@/lib/trpc";

export interface UseTurnActionsOptions {
  onTurnDeleted?: () => void;
  onTurnUpdated?: () => void;
}

export function useTurnActions(options: UseTurnActionsOptions = {}) {
  const { onTurnDeleted, onTurnUpdated } = options;

  const [turnToDelete, setTurnToDelete] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);

  const deleteTurnMutation = trpc.play.deleteTurn.useMutation({
    onSuccess: () => {
      toaster.success({ title: "Turn deleted" });
      onTurnDeleted?.();
      setShowDeleteDialog(false);
      setTurnToDelete(null);
    },
  });

  const updateTurnContentMutation = trpc.play.updateTurnContent.useMutation({
    onSuccess: () => {
      toaster.success({ title: "Turn updated" });
      setEditingTurnId(null);
      onTurnUpdated?.();
    },
  });

  const handleDeleteTurn = useCallback((turnId: string) => {
    setTurnToDelete(turnId);
    setShowDeleteDialog(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (turnToDelete) {
      deleteTurnMutation.mutate({ turnId: turnToDelete, cascade: false });
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
