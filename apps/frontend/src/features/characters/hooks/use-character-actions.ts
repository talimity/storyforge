import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { showSuccessToast } from "@/lib/error-handling";
import { nonBubblingHandler } from "@/lib/non-bubbling-handler";
import { useTRPC } from "@/lib/trpc";

export function useCharacterActions(characterId: string) {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteCharacterMutation = useMutation(
    trpc.characters.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.characters.list.pathFilter());
        setIsDeleteDialogOpen(false);
        showSuccessToast({ title: "Character deleted" });
      },
    })
  );

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
