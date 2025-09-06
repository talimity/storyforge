import { Text } from "@chakra-ui/react";
import type { ModelProfile } from "@storyforge/schemas";
import { useRef } from "react";
import { Button, Dialog } from "@/components/ui/index";
import { showSuccessToast } from "@/lib/error-handling";
import { trpc } from "@/lib/trpc";

interface DeleteModelProfileDialogProps {
  modelProfile: ModelProfile;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function DeleteModelProfileDialog({
  modelProfile,
  isOpen,
  onOpenChange,
}: DeleteModelProfileDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const utils = trpc.useUtils();

  const deleteModelProfileMutation =
    trpc.providers.deleteModelProfile.useMutation({
      onSuccess: () => {
        showSuccessToast({
          title: "Model profile deleted successfully",
          description: "Model profile has been removed",
        });
        utils.providers.listModelProfiles.invalidate();
        onOpenChange(false);
      },
    });

  const handleDelete = () => {
    deleteModelProfileMutation.mutate({ id: modelProfile.id });
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
          <Dialog.Title>Delete Model Profile</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Text>
            Are you sure you want to delete "{modelProfile.displayName}"? This
            action cannot be undone.
          </Text>
          <Text mt={2} fontSize="sm" color="content.muted">
            Model: {modelProfile.modelId}
          </Text>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.ActionTrigger asChild>
            <Button
              ref={cancelButtonRef}
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={deleteModelProfileMutation.isPending}
            >
              Cancel
            </Button>
          </Dialog.ActionTrigger>
          <Button
            colorPalette="red"
            onClick={handleDelete}
            loading={deleteModelProfileMutation.isPending}
            disabled={deleteModelProfileMutation.isPending}
          >
            Delete
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
