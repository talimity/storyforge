import {
  Box,
  Dialog,
  HStack,
  Icon,
  Image,
  Portal,
  Progress,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { LuFile, LuUpload, LuX } from "react-icons/lu";
import { Button, toaster } from "@/components/ui";

interface CharacterImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export function CharacterImportModal({
  isOpen,
  onClose,
  onImportSuccess,
}: CharacterImportModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ [key: string]: string }>(
    {}
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    handleFiles(files);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    // Filter for PNG files only
    const pngFiles = files.filter((file) => file.type === "image/png");

    if (pngFiles.length !== files.length) {
      toaster.create({
        title: "Invalid file format",
        description:
          "Only PNG files are supported. TavernCard character files must be in PNG format.",
        type: "error",
        duration: 5000,
      });
      return;
    }

    // Check file size (max 10MB per file)
    const oversizedFiles = pngFiles.filter(
      (file) => file.size > 10 * 1024 * 1024
    );
    if (oversizedFiles.length > 0) {
      toaster.create({
        title: "Files too large",
        description: `Files too large: ${oversizedFiles.map((f) => f.name).join(", ")}. Maximum size is 10MB.`,
        type: "error",
        duration: 5000,
      });
      return;
    }

    setSelectedFiles(pngFiles);

    // Generate previews
    const previews: { [key: string]: string } = {};
    pngFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        previews[file.name] = e.target?.result as string;
        setFilePreviews((prev) => ({ ...prev, ...previews }));
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadFile = async (file: File): Promise<void> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      "http://localhost:3001/api/characters/import",
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to upload ${file.name}`;

      if (response.status === 406) {
        errorMessage = `Invalid file format: ${file.name}`;
      } else if (response.status === 415) {
        errorMessage = `Invalid PNG file or missing character data: ${file.name}`;
      } else if (errorText) {
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = errorText;
        }
      }

      throw new Error(errorMessage);
    }

    return response.json();
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let successCount = 0;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (!file) continue;
        await uploadFile(file);
        successCount++;
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      }

      toaster.create({
        title: "Import successful",
        description: `Successfully imported ${successCount} character${successCount !== 1 ? "s" : ""}.`,
        type: "success",
        duration: 5000,
      });

      onImportSuccess();
      handleClose();
    } catch (err) {
      toaster.create({
        title: "Import failed",
        description:
          err instanceof Error
            ? err.message
            : "Failed to import characters. Please try again.",
        type: "error",
        duration: 7000,
      });
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFiles([]);
      setFilePreviews({});
      setUploadProgress(0);
      onClose();
    }
  };

  const removeFile = (index: number) => {
    const file = selectedFiles[index];
    if (!file) return;
    setSelectedFiles((files) => files.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      const newPreviews = { ...prev };
      delete newPreviews[file.name];
      return newPreviews;
    });
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={({ open }) => !open && handleClose()}
      size="lg"
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Import Character Cards</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Text color="fg.muted" fontSize="sm">
                  Upload TavernCard character files (PNG format) to import them
                  into your library.
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
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <VStack gap={3}>
                    <Icon fontSize="3xl" color="fg.muted">
                      <LuUpload />
                    </Icon>
                    <VStack gap={1}>
                      <Text fontWeight="medium">
                        Drop character PNG files here or click to browse
                      </Text>
                      <Text fontSize="sm" color="fg.muted">
                        Supports TavernCard PNG files up to 10MB each
                      </Text>
                    </VStack>
                    <Button size="sm" variant="outline" disabled={isUploading}>
                      Browse Files
                    </Button>
                  </VStack>

                  <input
                    id="file-input"
                    type="file"
                    accept="image/png"
                    multiple
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                    disabled={isUploading}
                  />
                </Box>

                {selectedFiles.length > 0 && (
                  <VStack gap={2} align="stretch">
                    <Text fontWeight="medium" fontSize="sm">
                      Selected Files ({selectedFiles.length})
                    </Text>
                    {selectedFiles.map((file, index) => (
                      <HStack
                        key={file.name}
                        p={3}
                        border="1px solid"
                        borderColor="border.muted"
                        borderRadius="md"
                        justify="space-between"
                      >
                        <HStack gap={3}>
                          {filePreviews[file.name] ? (
                            <Image
                              src={filePreviews[file.name]}
                              alt={file.name}
                              boxSize="40px"
                              borderRadius="md"
                              fit="cover"
                            />
                          ) : (
                            <Icon color="fg.muted">
                              <LuFile />
                            </Icon>
                          )}
                          <VStack gap={0} align="start">
                            <Text fontSize="sm" fontWeight="medium">
                              {file.name}
                            </Text>
                            <Text fontSize="xs" color="fg.muted">
                              {(file.size / 1024).toFixed(1)} KB
                            </Text>
                          </VStack>
                        </HStack>
                        {!isUploading && (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => removeFile(index)}
                          >
                            <LuX />
                          </Button>
                        )}
                      </HStack>
                    ))}
                  </VStack>
                )}

                {isUploading && (
                  <VStack gap={2}>
                    <Progress.Root value={uploadProgress}>
                      <Progress.Track>
                        <Progress.Range />
                      </Progress.Track>
                    </Progress.Root>
                    <Text fontSize="sm" color="fg.muted">
                      Importing characters... {uploadProgress}%
                    </Text>
                  </VStack>
                )}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack justify="space-between" width="full">
                <Button
                  variant="ghost"
                  onClick={handleClose}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button
                  colorPalette="primary"
                  onClick={handleUpload}
                  disabled={selectedFiles.length === 0 || isUploading}
                  loading={isUploading}
                  loadingText="Importing..."
                >
                  Import {selectedFiles.length} Character
                  {selectedFiles.length !== 1 ? "s" : ""}
                </Button>
              </HStack>
            </Dialog.Footer>

            <Dialog.CloseTrigger
              disabled={isUploading}
              position="absolute"
              top="2"
              right="2"
            />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
