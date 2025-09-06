import { Box, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import type React from "react";
import { LuFile, LuUpload, LuX } from "react-icons/lu";
import { Button } from "@/components/ui/index";
import { formatFileSize } from "@/features/scenario-import/services/file-validation";

interface ChatUploadStepProps {
  selectedFile: File | null;
  onBrowseClick: () => void;
  onFileInput: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onRemoveFile: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ChatUploadStep({
  selectedFile,
  onBrowseClick,
  onFileInput,
  onDrop,
  onDragOver,
  onRemoveFile,
  fileInputRef,
}: ChatUploadStepProps) {
  return (
    <VStack gap={4} align="stretch">
      <Text color="content.muted">
        Import a SillyTavern chat export (JSONL format) to create a new scenario
        with turn history.
      </Text>

      {!selectedFile ? (
        <Box
          layerStyle="surface"
          p={8}
          borderRadius="md"
          borderStyle="dashed"
          borderWidth={2}
          borderColor="surface.border"
          textAlign="center"
          cursor="pointer"
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={onBrowseClick}
        >
          <VStack gap={3}>
            <Icon size="xl">
              <LuUpload />
            </Icon>
            <Text fontWeight="medium">
              Drop your JSONL file here or click to browse
            </Text>
            <Text fontSize="sm" color="content.muted">
              Maximum file size: 50MB
            </Text>
          </VStack>
        </Box>
      ) : (
        <Box layerStyle="surface" p={4} borderRadius="md">
          <HStack justify="space-between">
            <HStack gap={3}>
              <Icon size="lg">
                <LuFile />
              </Icon>
              <VStack align="start" gap={0}>
                <Text fontWeight="medium">{selectedFile.name}</Text>
                <Text fontSize="sm" color="content.muted">
                  {formatFileSize(selectedFile.size)}
                </Text>
              </VStack>
            </HStack>
            <Button variant="ghost" size="sm" onClick={onRemoveFile}>
              <LuX />
            </Button>
          </HStack>
        </Box>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.jsonl,.txt"
        onChange={onFileInput}
        style={{ display: "none" }}
      />
    </VStack>
  );
}
