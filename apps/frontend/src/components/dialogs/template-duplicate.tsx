import { Input } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { Button, Dialog, Field } from "@/components/ui";

interface TemplateDuplicateDialogProps {
  isOpen: boolean;
  onOpenChange: (details: { open: boolean }) => void;
  originalName: string;
  onConfirmDuplicate: (newName: string) => void;
  isDuplicating?: boolean;
}

export function TemplateDuplicateDialog({
  isOpen,
  onOpenChange,
  originalName,
  onConfirmDuplicate,
  isDuplicating = false,
}: TemplateDuplicateDialogProps) {
  const [newName, setNewName] = useState(`${originalName} (Copy)`);
  const inputRef = useRef<HTMLInputElement>(null);
  const isValid = newName.trim().length > 0;

  const handleConfirm = () => {
    if (isValid) {
      onConfirmDuplicate(newName.trim());
    }
  };

  const handleCancel = () => {
    setNewName(`${originalName} (Copy)`);
    onOpenChange({ open: false });
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={onOpenChange}
      placement="center"
      initialFocusEl={() => inputRef.current}
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Duplicate Template</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Field label="Template Name" required>
            <Input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter template name"
              disabled={isDuplicating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isValid) {
                  handleConfirm();
                }
              }}
            />
          </Field>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.ActionTrigger asChild>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isDuplicating}
            >
              Cancel
            </Button>
          </Dialog.ActionTrigger>
          <Button
            colorPalette="primary"
            onClick={handleConfirm}
            loading={isDuplicating}
            disabled={isDuplicating || !isValid}
          >
            Duplicate
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
