import { Box, Heading, HStack, Icon, Image, Stack, Text, VStack } from "@chakra-ui/react";
import { LuUpload, LuX } from "react-icons/lu";
import { Button } from "@/components/ui/index";
import type { useImageField } from "@/hooks/use-image-field";

interface CharacterImageFieldProps {
  imageField: ReturnType<typeof useImageField>;
  isDisabled?: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}

export function CharacterImageField({
  imageField,
  isDisabled = false,
  onFileChange,
  onRemove,
}: CharacterImageFieldProps) {
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    await imageField.handleFiles(files);
  };

  return (
    <Stack gap={4}>
      <Heading size="md">Portrait Image</Heading>

      {!imageField.hasImage && (
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
          onClick={() => document.getElementById("image-input")?.click()}
        >
          <VStack gap={3}>
            <Icon fontSize="3xl" color="fg.muted">
              <LuUpload />
            </Icon>
            <VStack gap={1}>
              <Text fontWeight="medium">Drop portrait image here or click to browse</Text>
              <Text fontSize="xs" color="fg.muted">
                Supports PNG and JPEG files up to 10MB. A 2:3 aspect ratio is recommended.
              </Text>
            </VStack>
            <Button size="sm" variant="outline" disabled={isDisabled}>
              Select File
            </Button>
          </VStack>

          <input
            id="image-input"
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            style={{ display: "none" }}
            onChange={onFileChange}
            disabled={isDisabled}
          />
        </Box>
      )}

      {imageField.hasImage && (
        <HStack p={4} layerStyle="surface" justify="space-between" align="center">
          <HStack gap={3}>
            {imageField.getPreviewUrl() && (
              <Image
                src={imageField.getPreviewUrl() || undefined}
                alt="Portrait preview"
                boxSize="120px"
                borderRadius="md"
                fit="cover"
              />
            )}
            <VStack gap={0} align="start">
              <Text fontSize="sm" fontWeight="medium">
                {imageField.getDisplayName()}
              </Text>
              {imageField.getFileSize() && (
                <Text fontSize="xs" color="fg.muted">
                  {imageField.getFileSize()}
                </Text>
              )}
            </VStack>
          </HStack>
          {!isDisabled && (
            <Button size="sm" variant="ghost" onClick={onRemove}>
              <LuX />
            </Button>
          )}
        </HStack>
      )}
    </Stack>
  );
}
