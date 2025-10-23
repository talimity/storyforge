import { HStack } from "@chakra-ui/react";
import { AutosizeTextarea } from "@/components/ui";
import { CharacterMiniSelect } from "@/features/scenario-player/components/intent-panel/character-mini-select";
import { GenerateOrCancelButton } from "@/features/scenario-player/components/intent-panel/generate-or-cancel-button";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import { useIsInputFocused } from "@/hooks/use-is-input-focused";

type PromptInputProps = {
  withCharacterSelect?: boolean;
  characterSelectionRequired?: boolean;
  placeholder?: string;
  inputText: string;
  onInputChange: (text: string) => void;
  isGenerating?: boolean;
  onGenerate: () => void;
  onCancel: () => void;
};

export function PromptInput(props: PromptInputProps) {
  const {
    isGenerating,
    onGenerate,
    onCancel,
    withCharacterSelect,
    characterSelectionRequired,
    onInputChange,
    inputText,
    placeholder,
  } = props;

  const { characters, getCharacterById } = useScenarioContext();
  const { selectedCharacterId, setSelectedCharacter } = useScenarioPlayerStore();

  const selectedCharacter = getCharacterById(selectedCharacterId);
  const selectedCharacterName = selectedCharacter?.name ?? "";
  const selectionRequired = characterSelectionRequired ?? Boolean(withCharacterSelect);
  const hasSelectedCharacter = selectedCharacterName.length > 0;
  const textareaDisabled = selectionRequired && !hasSelectedCharacter;
  const hasGuidance = inputText.trim().length > 0;
  const disableGenerateButton = !isGenerating && (!hasGuidance || textareaDisabled);
  const textareaPlaceholder = selectedCharacterName
    ? (placeholder ?? `Enter ${selectedCharacterName}'s action or dialogue...`)
    : (placeholder ?? (selectionRequired ? "Select a character..." : "Share your guidance..."));

  const { ref: textareaRef, isFocused: isInputFocused } = useIsInputFocused();

  return (
    <HStack position="relative" isolation="isolate" alignItems="flex-start">
      {withCharacterSelect && (
        <CharacterMiniSelect
          characters={characters}
          value={selectedCharacterId}
          onChange={setSelectedCharacter}
          disabled={isGenerating}
          boxSize="10"
          layerStyle="contrast"
        />
      )}
      <AutosizeTextarea
        ref={textareaRef}
        placeholder={textareaPlaceholder}
        variant="onContrast"
        bg="bg"
        value={inputText}
        onChange={(e) => onInputChange(e.target.value)}
        disabled={textareaDisabled}
        minH={isInputFocused ? undefined : "10"}
        minRows={isInputFocused ? 3 : undefined}
        maxRows={isInputFocused ? 20 : 6}
        style={{ transition: "min-height 0.2s ease" }}
      />
      <GenerateOrCancelButton
        colorPalette="accent"
        onGenerate={onGenerate}
        onCancel={onCancel}
        isGenerating={!!isGenerating}
        disabled={disableGenerateButton}
      />
    </HStack>
  );
}
