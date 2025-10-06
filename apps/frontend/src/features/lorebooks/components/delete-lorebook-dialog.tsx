import { Text } from "@chakra-ui/react";
import { useRef } from "react";
import { Button, Dialog } from "@/components/ui";

interface DeleteLorebookDialogProps {
  lorebook: { id: string; name: string };
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export function DeleteLorebookDialog({
  lorebook,
  isOpen,
  onOpenChange,
  onDelete,
  isDeleting,
}: DeleteLorebookDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

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
          <Dialog.Title>Delete Lorebook</Dialog.Title>
          <Dialog.Description>
            This action cannot be undone. The lorebook will be removed from your library.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Body>
          <Text>
            Are you sure you want to delete "{lorebook.name}"? Any scenarios or characters using
            this lorebook will no longer reference it.
          </Text>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.ActionTrigger asChild>
            <Button
              ref={cancelRef}
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
          </Dialog.ActionTrigger>
          <Button colorPalette="red" onClick={onDelete} loading={isDeleting} disabled={isDeleting}>
            Delete
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
