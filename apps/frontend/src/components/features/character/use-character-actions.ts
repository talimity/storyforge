import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";

export function useCharacterActions(characterId: string) {
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const utils = trpc.useUtils();

  const deleteCharacterMutation = trpc.characters.delete.useMutation({
    onSuccess: () => {
      utils.characters.list.invalidate();
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      console.error("Failed to delete character:", error);
    },
  });

  const handleDelete = () => {
    deleteCharacterMutation.mutate({ id: characterId });
  };

  const handleEdit = () => {
    navigate(`/characters/${characterId}/edit`);
  };

  const openDeleteDialog = () => {
    setIsDeleteDialogOpen(true);
  };

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
