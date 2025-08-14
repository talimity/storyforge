import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";

export function useScenarioActions(scenarioId: string) {
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const utils = trpc.useUtils();

  const deleteScenarioMutation = trpc.scenarios.delete.useMutation({
    onSuccess: () => {
      utils.scenarios.list.invalidate();
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      console.error("Failed to delete scenario:", error);
    },
  });

  const handleDelete = () => {
    deleteScenarioMutation.mutate({ id: scenarioId });
  };

  const handleEdit = () => {
    navigate(`/scenarios/${scenarioId}/edit`);
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
    handleEdit,
    openDeleteDialog,
    closeDeleteDialog,
  };
}
