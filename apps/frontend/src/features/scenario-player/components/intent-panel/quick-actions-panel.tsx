import { HStack, Text } from "@chakra-ui/react";
import { Button } from "@/components/ui/index";
import { CharacterMiniSelect } from "@/features/scenario-player/components/intent-panel/character-mini-select";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";

interface QuickActionsPanelProps {
  isGenerating: boolean;
  onContinue?: () => void | Promise<void>;
}

export function QuickActionsPanel({ isGenerating, onContinue }: QuickActionsPanelProps) {
  const { characters, charactersById } = useScenarioContext();
  const { selectedCharacterId, setSelectedCharacter } = useScenarioPlayerStore();
  const selectedCharacterName = selectedCharacterId
    ? (charactersById[selectedCharacterId]?.name ?? "")
    : "";

  return (
    <HStack gap={2} wrap="wrap">
      <CharacterMiniSelect
        characters={characters}
        value={selectedCharacterId}
        onChange={setSelectedCharacter}
        disabled={isGenerating}
      />
      <Text fontSize="xs" color="content.muted">
        {selectedCharacterName ? `Next: ${selectedCharacterName}` : "Let the system decide"}
      </Text>
      <Button variant="outline" size="sm" onClick={() => onContinue?.()} disabled={isGenerating}>
        Continue
      </Button>
      <Button variant="outline" size="sm" onClick={() => undefined} disabled={isGenerating}>
        Jump Ahead
      </Button>
    </HStack>
  );
}
