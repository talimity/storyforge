import { Stack, Text } from "@chakra-ui/react";
import { useRef } from "react";
import { Button, Dialog } from "@/components/ui/index";

interface ScenarioDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (details: { open: boolean }) => void;
  scenarioName: string;
  hasTurns?: boolean;
  onConfirmDelete: () => void;
  isDeleting?: boolean;
}

export function ScenarioDeleteDialog({
  isOpen,
  onOpenChange,
  scenarioName,
  hasTurns,
  onConfirmDelete,
  isDeleting = false,
}: ScenarioDeleteDialogProps) {
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
          <Dialog.Title>Delete Scenario</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Stack>
            <Text>
              Are you sure you want to delete "{scenarioName}"? This action
              cannot be undone.
            </Text>
            {hasTurns && (
              <Text color="red.500">
                You will lose all turns and progress associated with this
                scenario!
              </Text>
            )}
          </Stack>
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
