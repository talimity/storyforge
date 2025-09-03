import { Text } from "@chakra-ui/react";
import type { ProviderConfig } from "@storyforge/schemas";
import { useRef } from "react";
import { Button, Dialog } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { showSuccessToast } from "@/lib/utils/error-handling";

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
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const utils = trpc.useUtils();

  const deleteProviderMutation = trpc.providers.deleteProvider.useMutation({
    onSuccess: () => {
      showSuccessToast({
        title: "Provider deleted successfully",
        description: "Provider configuration has been removed",
      });
      utils.providers.listProviders.invalidate();
      onOpenChange(false);
    },
  });

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
            Are you sure you want to delete "{provider.name}"? This action
            cannot be undone and will remove the provider configuration.
          </Text>
          <Text mt={2} fontSize="sm" color="content.muted">
            Any model profiles using this provider will also be affected.
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
