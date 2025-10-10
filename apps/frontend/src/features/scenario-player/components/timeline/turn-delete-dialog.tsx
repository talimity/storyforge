import { Text } from "@chakra-ui/react";
import { memo, useRef } from "react";
import { Button, Dialog } from "@/components/ui";

interface TurnDeleteDialogProps {
  isOpen: boolean;
  cascade?: boolean;
  isDeleting?: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export const TurnDeleteDialog = memo(function TurnDeleteDialog({
  isOpen,
  cascade = false,
  isDeleting = false,
  onSubmit,
  onClose,
}: TurnDeleteDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root
      role="alertdialog"
      open={isOpen}
      onOpenChange={(details) => !details.open && onClose()}
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
            <Button ref={cancelButtonRef} variant="outline" onClick={onClose} disabled={isDeleting}>
              Cancel
            </Button>
          </Dialog.ActionTrigger>
          <Button colorPalette="red" onClick={onSubmit} loading={isDeleting} disabled={isDeleting}>
            Delete
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
});
