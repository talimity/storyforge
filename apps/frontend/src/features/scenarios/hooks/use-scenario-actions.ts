import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc";

export function useScenarioActions(scenarioId: string) {
  const trpc = useTRPC();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteScenarioMutation = useMutation(
    trpc.scenarios.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.scenarios.list.pathFilter());
        setIsDeleteDialogOpen(false);
      },
      onError: (error) => {
        console.error("Failed to delete scenario:", error);
      },
    })
  );

  const handleDelete = () => {
    deleteScenarioMutation.mutate({ id: scenarioId });
  };

  const openDeleteDialog = () => {
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
  };

  return {
    isDeleteDialogOpen,
    deleteScenarioMutation,
    handleDelete,
    openDeleteDialog,
    closeDeleteDialog,
  };
}
