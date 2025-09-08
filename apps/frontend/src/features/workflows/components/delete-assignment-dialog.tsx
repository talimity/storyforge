import { Text } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Button, Dialog } from "@/components/ui/index";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

interface DeleteAssignmentDialogProps {
  id: string;
  label?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAssignmentDialog({
  id,
  label,
  isOpen,
  onOpenChange,
}: DeleteAssignmentDialogProps) {
  const trpc = useTRPC();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const del = useMutation(
    trpc.workflows.deleteScope.mutationOptions({
      onSuccess: async () => {
        showSuccessToast({ title: "Assignment deleted" });
        await queryClient.invalidateQueries(trpc.workflows.listScopes.pathFilter());
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
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Delete Assignment</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Text>
            Are you sure you want to delete this assignment
            {label ? ` for "${label}"` : ""}?
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
            onClick={() => del.mutate({ id })}
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
