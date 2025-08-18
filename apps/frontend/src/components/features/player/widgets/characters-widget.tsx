import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { memo } from "react";
import { CompactCharacterCard } from "@/components/features/character/compact-character-card";
import { useScenarioPlayerStore } from "@/stores/scenario-store";

interface Character {
  id: string;
  name: string;
  avatarPath: string | null;
}

interface CharactersWidgetProps {
  characters: Character[];
}

export const CharactersWidget = memo(function CharactersWidget({
  characters,
}: CharactersWidgetProps) {
  const { selectedCharacterId, setSelectedCharacter } =
    useScenarioPlayerStore();

  return (
    <Box>
      <Heading size="xs" color="content.muted" mb={3}>
        Characters ({characters.length})
      </Heading>
      {characters.length > 0 ? (
        <Stack gap={2}>
          {characters.map((character) => (
            <CompactCharacterCard
              key={character.id}
              character={{
                id: character.id,
                name: character.name,
                cardType: "character" as const,
                avatarPath: character.avatarPath,
              }}
              isSelected={selectedCharacterId === character.id}
              onSelectionToggle={() => {
                setSelectedCharacter(
                  selectedCharacterId === character.id ? null : character.id
                );
              }}
            />
          ))}
        </Stack>
      ) : (
        <Text fontSize="xs" color="content.muted">
          No characters in this scenario
        </Text>
      )}
    </Box>
  );
});
