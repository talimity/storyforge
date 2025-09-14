import { Text } from "@chakra-ui/react";
import { useRef } from "react";
import { Button, Dialog } from "@/components/ui";

interface DiscardChangesDialogProps {
  isOpen: boolean;
  onOpenChange: (details: { open: boolean }) => void;
  onConfirm: () => void;
}

export function DiscardChangesDialog({
  isOpen,
  onOpenChange,
  onConfirm,
}: DiscardChangesDialogProps) {
  const keepEditingButtonRef = useRef<HTMLButtonElement>(null);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog.Root
      role="alertdialog"
      open={isOpen}
      onOpenChange={onOpenChange}
      placement="center"
      initialFocusEl={() => keepEditingButtonRef.current}
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Discard Changes?</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Text>You have unsaved changes. Are you sure you want to discard them?</Text>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.ActionTrigger asChild>
            <Button
              ref={keepEditingButtonRef}
              variant="outline"
              onClick={() => onOpenChange({ open: false })}
            >
              Keep Editing
            </Button>
          </Dialog.ActionTrigger>
          <Button colorPalette="red" onClick={onConfirm}>
            Discard Changes
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
