import { Text } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Button, Dialog } from "@/components/ui/index";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

interface DeleteWorkflowDialogProps {
  workflow: { id: string; name: string };
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteWorkflowDialog({
  workflow,
  isOpen,
  onOpenChange,
}: DeleteWorkflowDialogProps) {
  const trpc = useTRPC();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const del = useMutation(
    trpc.workflows.delete.mutationOptions({
      onSuccess: async () => {
        showSuccessToast({ title: "Workflow deleted" });
        await queryClient.invalidateQueries(trpc.workflows.list.pathFilter());
        onOpenChange(false);
      },
    })
  );

  return (
    <Dialog.Root
      role="alertdialog"
      open={isOpen}
      onOpenChange={({ open }) => onOpenChange(open)}
      placement="center"
      initialFocusEl={() => cancelRef.current}
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Delete Workflow</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Text>
            Are you sure you want to delete "{workflow.name}"? This action cannot be undone.
          </Text>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.ActionTrigger asChild>
            <Button
              ref={cancelRef}
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={del.isPending}
            >
              Cancel
            </Button>
          </Dialog.ActionTrigger>
          <Button
            colorPalette="red"
            onClick={() => del.mutate({ id: workflow.id })}
            loading={del.isPending}
            disabled={del.isPending}
          >
            Delete
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
