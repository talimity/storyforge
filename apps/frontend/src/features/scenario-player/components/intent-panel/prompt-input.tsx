import { Box, HStack } from "@chakra-ui/react";
import { AutosizeTextarea } from "@/components/ui/index";
import { CharacterMiniSelect } from "@/features/scenario-player/components/intent-panel/character-mini-select";
import { GenerateOrCancelButton } from "@/features/scenario-player/components/intent-panel/generate-or-cancel-button";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";

type PromptInputProps = {
  withCharacterSelect?: boolean;
  inputText: string;
  onInputChange: (text: string) => void;
  isGenerating?: boolean;
  onGenerate: () => void;
  onCancel: () => void;
};

export function PromptInput(props: PromptInputProps) {
  const { isGenerating, onGenerate, onCancel, withCharacterSelect, onInputChange, inputText } =
    props;

  const { characters, charactersById } = useScenarioContext();
  const { selectedCharacterId, setSelectedCharacter } = useScenarioPlayerStore();

  const selectedCharacter = selectedCharacterId ? charactersById[selectedCharacterId] : null;
  const selectedCharacterName = selectedCharacter?.name ?? "";

  const isDisabled = !inputText.trim() || isGenerating;

  return (
    <Box position="relative" isolation="isolate">
      <AutosizeTextarea
        placeholder={
          selectedCharacterName
            ? `Enter ${selectedCharacterName}'s action or dialogue...`
            : "Select a character..."
        }
        variant="onContrast"
        bg="bg"
        pb={12}
        value={inputText}
        onChange={(e) => onInputChange(e.target.value)}
        disabled={!selectedCharacterName}
      />
      <HStack
        gap="1"
        position="absolute"
        bottom="2"
        insetStart="2"
        insetEnd="2"
        zIndex="1"
        justify="space-between"
      >
        {withCharacterSelect && (
          <CharacterMiniSelect
            characters={characters}
            value={selectedCharacterId}
            onChange={setSelectedCharacter}
            disabled={isGenerating}
            py={0}
          />
        )}
        <GenerateOrCancelButton
          colorPalette="accent"
          onGenerate={onGenerate}
          onCancel={onCancel}
          isGenerating={!!isGenerating}
          disabled={!isGenerating && isDisabled}
        />
      </HStack>
    </Box>
  );
}
