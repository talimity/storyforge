import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { showErrorToast } from "@/lib/utils/error-handling";

export function useTemplateActions(templateId: string) {
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const utils = trpc.useUtils();

  const deleteTemplateMutation = trpc.templates.delete.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      setIsDeleteDialogOpen(false);
    },
  });

  const duplicateTemplateMutation = trpc.templates.duplicate.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      setIsDuplicateDialogOpen(false);
    },
  });

  const exportTemplateQuery = trpc.templates.export.useQuery(
    { id: templateId },
    {
      enabled: false, // Only run when manually triggered
    }
  );

  const handleDelete = () => {
    deleteTemplateMutation.mutate({ id: templateId });
  };

  const handleEdit = () => {
    navigate(`/templates/${templateId}/edit`);
  };

  const handleDuplicate = (newName: string) => {
    duplicateTemplateMutation.mutate({ id: templateId, name: newName });
  };

  const handleExport = async () => {
    try {
      const result = await exportTemplateQuery.refetch();
      if (result.data) {
        const jsonData = JSON.stringify(result.data.template, null, 2);
        const blob = new Blob([jsonData], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `${result.data.template.name.toLowerCase().replace(/\s+/g, "-")}-template.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      showErrorToast({
        title: "Export Failed",
        fallbackMessage: "Unable to export the template. Please try again.",
        error,
      });
    }
  };

  const openDeleteDialog = () => {
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
  };

  const openDuplicateDialog = () => {
    setIsDuplicateDialogOpen(true);
  };

  const closeDuplicateDialog = () => {
    setIsDuplicateDialogOpen(false);
  };

  return {
    isDeleteDialogOpen,
    isDuplicateDialogOpen,
    deleteTemplateMutation,
    duplicateTemplateMutation,
    exportTemplateQuery,
    handleDelete,
    handleEdit,
    handleDuplicate,
    handleExport,
    openDeleteDialog,
    closeDeleteDialog,
    openDuplicateDialog,
    closeDuplicateDialog,
  };
}
