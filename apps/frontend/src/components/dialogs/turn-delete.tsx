import { Text } from "@chakra-ui/react";
import { Button, Dialog } from "@/components/ui";

interface TurnDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (details: { open: boolean }) => void;
  onConfirmDelete: () => void;
  isDeleting?: boolean;
}

export function TurnDeleteDialog({
  isOpen,
  onOpenChange,
  onConfirmDelete,
  isDeleting = false,
}: TurnDeleteDialogProps) {
  return (
    <Dialog.Root
      role="alertdialog"
      open={isOpen}
      onOpenChange={onOpenChange}
      placement="center"
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Delete Turn</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Text>
            Are you sure you want to delete this turn? This action cannot be
            undone.
          </Text>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.ActionTrigger asChild>
            <Button
              variant="outline"
              onClick={() => onOpenChange({ open: false })}
              disabled={isDeleting}
            >
              Cancel
            </Button>
          </Dialog.ActionTrigger>
          <Button
            colorPalette="red"
            onClick={onConfirmDelete}
            loading={isDeleting}
            disabled={isDeleting}
          >
            Delete
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
