import { HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { GenerateOrCancelButton } from "./generate-or-cancel-button";

interface StoryConstraintsPanelProps {
  inputText: string;
  onInputChange: (text: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  isGenerating: boolean;
}

export function StoryConstraintsPanel({
  inputText,
  onInputChange,
  onGenerate,
  onCancel,
  isGenerating,
}: StoryConstraintsPanelProps) {
  return (
    <Stack gap={3}>
      <HStack>
        <Text fontSize="xs" color="content.muted">
          Constraint type:
        </Text>
        <Text fontSize="xs" fontWeight="semibold">
          Plot Development
        </Text>
      </HStack>
      <HStack gap={2} align="flex-end">
        <Textarea
          placeholder="Describe what should happen next..."
          size="sm"
          resize="vertical"
          autoresize
          rows={2}
          maxH={32}
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          flex="1"
        />
        <GenerateOrCancelButton
          colorPalette="primary"
          variant="solid"
          size="sm"
          onGenerate={onGenerate}
          onCancel={onCancel}
          isGenerating={isGenerating}
          disabled={!isGenerating && !inputText.trim()}
        />
      </HStack>
    </Stack>
  );
}
