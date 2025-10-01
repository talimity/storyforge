import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

export function useCharacterActions(characterId: string) {
  const trpc = useTRPC();
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
    openDeleteDialog,
    closeDeleteDialog,
  };
}
