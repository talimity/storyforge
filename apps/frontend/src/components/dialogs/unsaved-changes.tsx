import { HStack, Text } from "@chakra-ui/react";
import { Button, Dialog } from "@/components/ui";

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
}

export function UnsavedChangesDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = "Unsaved Changes",
  message = "You have unsaved changes. Are you sure you want to leave?",
}: UnsavedChangesDialogProps) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(e) => !e.open && onCancel()}
      placement="center"
      data-testid="unsaved-changes-dialog"
      size="md"
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Text>{message}</Text>
        </Dialog.Body>
        <Dialog.Footer>
          <HStack gap={3}>
            <Button variant="outline" onClick={onCancel}>
              Stay
            </Button>
            <Button colorPalette="red" onClick={onConfirm}>
              Leave Without Saving
            </Button>
          </HStack>
        </Dialog.Footer>
        <Dialog.CloseTrigger />
      </Dialog.Content>
    </Dialog.Root>
  );
}
