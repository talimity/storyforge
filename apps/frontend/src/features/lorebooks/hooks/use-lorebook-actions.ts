import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

export function useLorebookActions(lorebookId: string) {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const deleteLorebookMutation = useMutation(
    trpc.lorebooks.delete.mutationOptions({
      onSuccess: async () => {
        showSuccessToast({ title: "Lorebook deleted" });
        await queryClient.invalidateQueries(trpc.lorebooks.pathFilter());
        setIsDeleteDialogOpen(false);
      },
    })
  );

  const handleDelete = () => deleteLorebookMutation.mutate({ id: lorebookId });
  const handleEdit = () => navigate(`/lorebooks/${lorebookId}/edit`);
  const openDeleteDialog = () => setIsDeleteDialogOpen(true);
  const closeDeleteDialog = () => setIsDeleteDialogOpen(false);

  return {
    isDeleteDialogOpen,
    deleteLorebookMutation,
    handleDelete,
    handleEdit,
    openDeleteDialog,
    closeDeleteDialog,
  };
}
