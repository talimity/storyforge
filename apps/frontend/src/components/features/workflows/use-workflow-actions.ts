import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { showErrorToast } from "@/lib/utils/error-handling";

export function useWorkflowActions(workflowId: string) {
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const utils = trpc.useUtils();

  const deleteWorkflowMutation = trpc.workflows.delete.useMutation({
    onSuccess: async () => {
      await utils.workflows.list.invalidate();
      setIsDeleteDialogOpen(false);
    },
  });

  const exportWorkflowQuery = trpc.workflows.export.useQuery(
    { id: workflowId },
    { enabled: false }
  );

  const handleDelete = () => deleteWorkflowMutation.mutate({ id: workflowId });
  const handleEdit = () => navigate(`/workflows/${workflowId}/edit`);
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

  return {
    isDeleteDialogOpen,
    deleteWorkflowMutation,
    exportWorkflowQuery,
    handleDelete,
    handleEdit,
    handleExport,
    openDeleteDialog,
    closeDeleteDialog,
  };
}
