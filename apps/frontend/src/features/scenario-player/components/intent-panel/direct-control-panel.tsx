import { HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { Avatar } from "@/components/ui/index";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import { getApiUrl } from "@/lib/get-api-url";
import { GenerateOrCancelButton } from "./generate-or-cancel-button";

interface DirectControlPanelProps {
  inputText: string;
  onInputChange: (text: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  isGenerating: boolean;
}

export function DirectControlPanel({
  inputText,
  onInputChange,
  onGenerate,
  onCancel,
  isGenerating,
}: DirectControlPanelProps) {
  const { charactersById } = useScenarioContext();
  const { selectedCharacterId } = useScenarioPlayerStore();
  if (!selectedCharacterId) {
    console.warn("Invariant violation: No character selected");
    return null;
  }

  const selectedCharacter = charactersById[selectedCharacterId];
  const selectedCharacterName = selectedCharacter.name || "";
  const avatarSrc = getApiUrl(selectedCharacter.avatarPath);

  const isDisabled = !inputText.trim() || isGenerating;

  return (
    <Stack gap={3}>
      <HStack gap={1}>
        <Text fontSize="xs" color="content.muted">
          Speaking as:
        </Text>
        <Avatar
          shape="rounded"
          layerStyle="contrast"
          name={selectedCharacterName}
          src={avatarSrc}
          size="2xs"
        />
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
        <GenerateOrCancelButton
          colorPalette="accent"
          size="md"
          onGenerate={onGenerate}
          onCancel={onCancel}
          isGenerating={isGenerating}
          disabled={!isGenerating && isDisabled}
        />
      </HStack>
    </Stack>
  );
}
