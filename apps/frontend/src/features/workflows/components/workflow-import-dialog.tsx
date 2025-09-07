import { Box, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { LuFile, LuUpload, LuX } from "react-icons/lu";
import { Button, Dialog } from "@/components/ui/index";
import { trpc } from "@/lib/trpc";

interface WorkflowImportDialogProps {
  isOpen: boolean;
  onOpenChange: (details: { open: boolean }) => void;
}

export function WorkflowImportDialog({ isOpen, onOpenChange }: WorkflowImportDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const browseButtonRef = useRef<HTMLButtonElement>(null);
  const utils = trpc.useUtils();

  const importWorkflowMutation = trpc.workflows.import.useMutation({
    onSuccess: async () => {
      await utils.workflows.list.invalidate();
      handleClose();
    },
    onError: (error) => setImportError(error.message || "Failed to import workflow"),
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (event: React.DragEvent) => event.preventDefault();
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFile = (file: File) => {
    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
      setImportError("Invalid file format. Only JSON files are supported.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setImportError("File too large. Maximum size is 1MB.");
      return;
    }
    setSelectedFile(file);
    setImportError(null);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    try {
      const text = await selectedFile.text();
      const workflow = JSON.parse(text);
      if (!workflow || !workflow.name || !workflow.task || !workflow.steps) {
        setImportError("Invalid workflow file. Missing required fields.");
        return;
      }
      await importWorkflowMutation.mutateAsync({ workflow });
    } catch (e) {
      setImportError(
        e instanceof SyntaxError ? "Invalid JSON file." : "Failed to import workflow."
      );
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setImportError(null);
    onOpenChange({ open: false });
  };

  const removeFile = () => {
    setSelectedFile(null);
    setImportError(null);
  };

  const isValid = !!selectedFile && !importWorkflowMutation.isPending;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={onOpenChange}
      placement="center"
      size="lg"
      initialFocusEl={() => browseButtonRef.current}
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Import Workflow</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <VStack gap={4} align="stretch">
            <Text color="content.muted" fontSize="sm">
              Upload a JSON workflow file to import it into your library.
            </Text>
            <Box
              border="2px dashed"
              borderColor="border.muted"
              borderRadius="md"
              p={8}
              textAlign="center"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              _hover={{ borderColor: "border.emphasized" }}
              cursor="pointer"
              onClick={() => document.getElementById("wf-file-input")?.click()}
            >
              <VStack gap={3}>
                <Icon fontSize="3xl" color="content.muted">
                  <LuUpload />
                </Icon>
                <VStack gap={1}>
                  <Text fontWeight="medium">Drop workflow JSON file here or click to browse</Text>
                  <Text fontSize="sm" color="content.muted">
                    Supports JSON files up to 1MB
                  </Text>
                </VStack>
                <Button
                  ref={browseButtonRef}
                  size="sm"
                  variant="outline"
                  disabled={importWorkflowMutation.isPending}
                >
                  Browse Files
                </Button>
              </VStack>
              <input
                id="wf-file-input"
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleFileChange}
                disabled={importWorkflowMutation.isPending}
              />
            </Box>
            {selectedFile && (
              <VStack gap={2} align="stretch">
                <Text fontWeight="medium" fontSize="sm">
                  Selected File
                </Text>
                <HStack
                  p={3}
                  border="1px solid"
                  borderColor="border.muted"
                  borderRadius="md"
                  justify="space-between"
                >
                  <HStack gap={3}>
                    <Icon color="content.muted">
                      <LuFile />
                    </Icon>
                    <VStack gap={0} align="start">
                      <Text fontSize="sm" fontWeight="medium">
                        {selectedFile.name}
                      </Text>
                      <Text fontSize="xs" color="content.muted">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </Text>
                    </VStack>
                  </HStack>
                  {!importWorkflowMutation.isPending && (
                    <Button size="xs" variant="ghost" onClick={removeFile}>
                      <LuX />
                    </Button>
                  )}
                </HStack>
              </VStack>
            )}
            {importError && (
              <Box
                p={3}
                bg="bg.error"
                color="fg.error"
                borderRadius="md"
                border="1px solid"
                borderColor="border.error"
              >
                <Text fontSize="sm">{importError}</Text>
              </Box>
            )}
          </VStack>
        </Dialog.Body>
        <Dialog.Footer>
          <HStack justify="space-between" width="full">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={importWorkflowMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              colorPalette="primary"
              onClick={handleImport}
              disabled={!isValid}
              loading={importWorkflowMutation.isPending}
              loadingText="Importing..."
            >
              Import Workflow
            </Button>
          </HStack>
        </Dialog.Footer>
        <Dialog.CloseTrigger disabled={importWorkflowMutation.isPending} />
      </Dialog.Content>
    </Dialog.Root>
  );
}
