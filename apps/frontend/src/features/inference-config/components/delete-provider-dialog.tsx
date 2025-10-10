import { Text } from "@chakra-ui/react";
import type { ProviderConfig } from "@storyforge/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Button, Dialog } from "@/components/ui";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

interface DeleteProviderDialogProps {
  provider: ProviderConfig;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function DeleteProviderDialog({
  provider,
  isOpen,
  onOpenChange,
}: DeleteProviderDialogProps) {
  const trpc = useTRPC();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const deleteProviderMutation = useMutation(
    trpc.providers.delete.mutationOptions({
      onSuccess: () => {
        showSuccessToast({
          title: "Provider deleted successfully",
          description: "Provider configuration has been removed",
        });
        queryClient.invalidateQueries(trpc.providers.list.pathFilter());
        queryClient.invalidateQueries(trpc.providers.listModelProfiles.pathFilter());
        onOpenChange(false);
      },
    })
  );

  const handleDelete = () => {
    deleteProviderMutation.mutate({ id: provider.id });
  };

  return (
    <Dialog.Root
      role="alertdialog"
      open={isOpen}
      onOpenChange={({ open }) => onOpenChange(open)}
      placement="center"
      initialFocusEl={() => cancelButtonRef.current}
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Delete Provider</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Text>
            Are you sure you want to delete "{provider.name}"? This action cannot be undone.
          </Text>
          <Text mt={2} fontSize="sm" color="content.muted">
            Any model profiles using this provider will also be deleted, which may break workflows
            that were relying on them.
          </Text>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.ActionTrigger asChild>
            <Button
              ref={cancelButtonRef}
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={deleteProviderMutation.isPending}
            >
              Cancel
            </Button>
          </Dialog.ActionTrigger>
          <Button
            colorPalette="red"
            onClick={handleDelete}
            loading={deleteProviderMutation.isPending}
            disabled={deleteProviderMutation.isPending}
          >
            Delete
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
