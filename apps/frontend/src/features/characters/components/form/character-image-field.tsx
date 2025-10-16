import { Heading, HStack, Image, Stack, Text, VStack } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";
import { Button } from "@/components/ui/index";
import type { useImageField } from "@/hooks/use-image-field";

interface CharacterImageFieldProps {
  imageField: ReturnType<typeof useImageField>;
  isDisabled?: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  onAdjustCrop?: () => void;
  overridePreviewUrl?: string;
  onResetCrop?: () => void;
  isResettingCrop?: boolean;
}

export function CharacterImageField({
  imageField,
  isDisabled = false,
  onRemove,
  onAdjustCrop,
  overridePreviewUrl,
  onResetCrop,
  isResettingCrop = false,
}: CharacterImageFieldProps) {
  return (
    <Stack gap={4}>
      <Heading size="md">Portrait Image</Heading>

      {imageField.hasImage && (
        <HStack p={4} layerStyle="surface" justify="space-between" align="center">
          <HStack gap={3}>
            {(overridePreviewUrl || imageField.getPreviewUrl()) && (
              <Image
                src={(overridePreviewUrl || imageField.getPreviewUrl()) ?? undefined}
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
            <HStack gap={2}>
              {onResetCrop && imageField.state.type === "existing" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onResetCrop}
                  loading={isResettingCrop}
                  disabled={isResettingCrop}
                >
                  Reset to Auto Crop
                </Button>
              )}
              {onAdjustCrop && imageField.state.type === "existing" && (
                <Button size="sm" variant="outline" onClick={onAdjustCrop}>
                  Adjust Avatar Crop
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onRemove}>
                <LuX />
              </Button>
            </HStack>
          )}
        </HStack>
      )}
    </Stack>
  );
}
