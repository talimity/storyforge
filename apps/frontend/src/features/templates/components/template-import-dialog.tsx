import { Box, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { LuFile, LuUpload, LuX } from "react-icons/lu";
import { Button, Dialog } from "@/components/ui/index";
import { useTRPC } from "@/lib/trpc";

interface TemplateImportDialogProps {
  isOpen: boolean;
  onOpenChange: (details: { open: boolean }) => void;
}

export function TemplateImportDialog({ isOpen, onOpenChange }: TemplateImportDialogProps) {
  const trpc = useTRPC();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const browseButtonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const importTemplateMutation = useMutation(
    trpc.templates.import.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.templates.list.pathFilter());
        handleClose();
      },
      onError: (error) => {
        setImportError(error.message || "Failed to import template");
      },
    })
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = (file: File) => {
    // Filter for JSON files only
    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
      setImportError("Invalid file format. Only JSON files are supported for template import.");
      return;
    }

    // Check file size (max 1MB per file)
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
      const fileContent = await selectedFile.text();
      const templateData = JSON.parse(fileContent);

      // Validate that it's a valid template by checking required fields
      if (!templateData.name || !templateData.task || !templateData.layout || !templateData.slots) {
        setImportError("Invalid template file. Missing required fields.");
        return;
      }

      await importTemplateMutation.mutateAsync({
        template: templateData,
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        setImportError("Invalid JSON file. Please check the file format.");
      } else {
        setImportError("Failed to import template. Please try again.");
      }
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

  const isValid = selectedFile && !importTemplateMutation.isPending;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      placement="center"
      initialFocusEl={() => browseButtonRef.current}
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Import Template</Dialog.Title>
        </Dialog.Header>

        <Dialog.Body>
          <VStack gap={4} align="stretch">
            <Text color="content.muted" fontSize="sm">
              Upload a JSON template file to import it into your library.
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
              onClick={() => document.getElementById("template-file-input")?.click()}
            >
              <VStack gap={3}>
                <Icon fontSize="3xl" color="content.muted">
                  <LuUpload />
                </Icon>
                <VStack gap={1}>
                  <Text fontWeight="medium">Drop template JSON file here or click to browse</Text>
                  <Text fontSize="sm" color="content.muted">
                    Supports JSON template files up to 1MB
                  </Text>
                </VStack>
                <Button
                  ref={browseButtonRef}
                  size="sm"
                  variant="outline"
                  disabled={importTemplateMutation.isPending}
                >
                  Browse Files
                </Button>
              </VStack>

              <input
                id="template-file-input"
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleFileChange}
                disabled={importTemplateMutation.isPending}
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
                  {!importTemplateMutation.isPending && (
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
              disabled={importTemplateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              colorPalette="primary"
              onClick={handleImport}
              disabled={!isValid}
              loading={importTemplateMutation.isPending}
              loadingText="Importing..."
            >
              Import Template
            </Button>
          </HStack>
        </Dialog.Footer>

        <Dialog.CloseTrigger disabled={importTemplateMutation.isPending} />
      </Dialog.Content>
    </Dialog.Root>
  );
}
