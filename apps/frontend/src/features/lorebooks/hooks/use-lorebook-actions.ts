import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

export function useLorebookActions(lorebookId: string) {
  const trpc = useTRPC();
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
  const openDeleteDialog = () => setIsDeleteDialogOpen(true);
  const closeDeleteDialog = () => setIsDeleteDialogOpen(false);

  return {
    isDeleteDialogOpen,
    deleteLorebookMutation,
    handleDelete,
    openDeleteDialog,
    closeDeleteDialog,
  };
}
