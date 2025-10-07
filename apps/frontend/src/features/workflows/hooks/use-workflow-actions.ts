import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { showErrorToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

export function useWorkflowActions(workflowId: string) {
  const trpc = useTRPC();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteWorkflowMutation = useMutation(
    trpc.workflows.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.workflows.list.pathFilter());
        setIsDeleteDialogOpen(false);
      },
    })
  );

  const exportWorkflowQuery = useQuery(
    trpc.workflows.export.queryOptions({ id: workflowId }, { enabled: false })
  );

  const handleDelete = () => deleteWorkflowMutation.mutate({ id: workflowId });
  const openDeleteDialog = () => setIsDeleteDialogOpen(true);
  const closeDeleteDialog = () => setIsDeleteDialogOpen(false);

  const handleExport = async () => {
    try {
      const result = await exportWorkflowQuery.refetch();
      if (result.data) {
        const json = JSON.stringify(result.data.workflow, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${result.data.workflow.name.toLowerCase().replace(/\s+/g, "-")}-workflow.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      showErrorToast({
        title: "Export Failed",
        fallbackMessage: "Unable to export the workflow.",
        error,
      });
    }
  };

  const duplicateWorkflowMutation = useMutation(
    trpc.workflows.duplicate.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.workflows.list.pathFilter());
        setIsDuplicateDialogOpen(false);
      },
    })
  );

  const handleDuplicate = (newName: string) =>
    duplicateWorkflowMutation.mutate({ id: workflowId, name: newName });
  const openDuplicateDialog = () => setIsDuplicateDialogOpen(true);
  const closeDuplicateDialog = () => setIsDuplicateDialogOpen(false);

  return {
    isDeleteDialogOpen,
    isDuplicateDialogOpen,
    deleteWorkflowMutation,
    duplicateWorkflowMutation,
    exportWorkflowQuery,
    handleDelete,
    handleDuplicate,
    handleExport,
    openDeleteDialog,
    closeDeleteDialog,
    openDuplicateDialog,
    closeDuplicateDialog,
  };
}
