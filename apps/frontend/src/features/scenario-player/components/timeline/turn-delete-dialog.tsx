import { Text } from "@chakra-ui/react";
import { useRef } from "react";
import { Button, Dialog } from "@/components/ui/index";

interface TurnDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (details: { open: boolean }) => void;
  onConfirmDelete: () => void;
  isDeleting?: boolean;
  cascade?: boolean;
}

export function TurnDeleteDialog({
  isOpen,
  onOpenChange,
  onConfirmDelete,
  isDeleting = false,
  cascade = false,
}: TurnDeleteDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root
      role="alertdialog"
      open={isOpen}
      onOpenChange={onOpenChange}
      placement="center"
      initialFocusEl={() => cancelButtonRef.current}
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{cascade ? "Delete Entire Branch" : "Delete Turn"}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Text>
            {cascade
              ? "Are you sure you want to delete this turn and all following turns? This action cannot be undone."
              : "Are you sure you want to delete this turn? This action cannot be undone."}
          </Text>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.ActionTrigger asChild>
            <Button
              ref={cancelButtonRef}
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
