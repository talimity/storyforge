import { useDisclosure } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { showErrorToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

export function useTemplateActions(templateId: string) {
  const trpc = useTRPC();
  const deleteDialog = useDisclosure();
  const duplicateDialog = useDisclosure();
  const queryClient = useQueryClient();

  const deleteTemplateMutation = useMutation(
    trpc.templates.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.templates.list.pathFilter());
        deleteDialog.onClose();
      },
    })
  );

  const duplicateTemplateMutation = useMutation(
    trpc.templates.duplicate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.templates.list.pathFilter());
        duplicateDialog.onClose();
      },
    })
  );

  const exportTemplateQuery = useQuery(
    trpc.templates.export.queryOptions(
      { id: templateId },
      // Only run when manually triggered
      { enabled: false }
    )
  );

  const handleDelete = () => {
    deleteTemplateMutation.mutate({ id: templateId });
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

  return {
    isDeleteDialogOpen: deleteDialog.open,
    isDuplicateDialogOpen: duplicateDialog.open,
    deleteTemplateMutation,
    duplicateTemplateMutation,
    exportTemplateQuery,
    handleDelete,
    handleDuplicate,
    handleExport,
    openDeleteDialog: deleteDialog.onOpen,
    closeDeleteDialog: deleteDialog.onClose,
    openDuplicateDialog: duplicateDialog.onOpen,
    closeDuplicateDialog: duplicateDialog.onClose,
  };
}
