import { HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { RiQuillPenLine } from "react-icons/ri";
import { Button } from "@/components/ui";

interface DirectControlPanelProps {
  selectedCharacterName: string | null;
  inputText: string;
  onInputChange: (text: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function DirectControlPanel({
  selectedCharacterName,
  inputText,
  onInputChange,
  onGenerate,
  isGenerating,
}: DirectControlPanelProps) {
  const isDisabled =
    !selectedCharacterName || !inputText.trim() || isGenerating;

  return (
    <Stack gap={3}>
      <HStack>
        <Text fontSize="xs" color="content.muted">
          Speaking as:
        </Text>
        <Text fontSize="xs" fontWeight="semibold">
          {selectedCharacterName || "No character selected"}
        </Text>
      </HStack>
      <HStack gap={2} align="flex-end">
        <Textarea
          placeholder={
            selectedCharacterName
              ? `Enter ${selectedCharacterName}'s action or dialogue...`
              : "Select a character..."
          }
          variant="onContrast"
          autoresize
          rows={2}
          maxH={40}
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          disabled={!selectedCharacterName}
        />
        <Button
          colorPalette="accent"
          size="md"
          onClick={onGenerate}
          disabled={isDisabled}
          loading={isGenerating}
        >
          <RiQuillPenLine />
          Generate
        </Button>
      </HStack>
    </Stack>
  );
}
