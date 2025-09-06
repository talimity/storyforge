import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { showSuccessToast } from "@/lib/error-handling";
import { nonBubblingHandler } from "@/lib/non-bubbling-handler";
import { trpc } from "@/lib/trpc";

export function useCharacterActions(characterId: string) {
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const utils = trpc.useUtils();

  const deleteCharacterMutation = trpc.characters.delete.useMutation({
    onSuccess: () => {
      utils.characters.list.invalidate();
      setIsDeleteDialogOpen(false);
      showSuccessToast({ title: "Character deleted" });
    },
  });

  const handleDelete = () => {
    deleteCharacterMutation.mutate({ id: characterId });
  };

  const handleEdit = nonBubblingHandler(() => {
    navigate(`/characters/${characterId}/edit`);
  });

  const openDeleteDialog = nonBubblingHandler(() => {
    setIsDeleteDialogOpen(true);
  });

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
  };

  return {
    isDeleteDialogOpen,
    deleteCharacterMutation,
    handleDelete,
    handleEdit,
    openDeleteDialog,
    closeDeleteDialog,
  };
}
