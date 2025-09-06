import { HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { RiQuillPenLine } from "react-icons/ri";
import { Avatar, Button } from "@/components/ui/index";
import { useScenarioCtx } from "@/features/scenario-player/providers/scenario-provider";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-store";
import { getApiUrl } from "@/lib/trpc";

interface DirectControlPanelProps {
  inputText: string;
  onInputChange: (text: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function DirectControlPanel({
  inputText,
  onInputChange,
  onGenerate,
  isGenerating,
}: DirectControlPanelProps) {
  const { charactersById } = useScenarioCtx();
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
