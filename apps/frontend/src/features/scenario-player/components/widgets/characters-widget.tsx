import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { memo } from "react";
import { LuCheck } from "react-icons/lu";
import { CharacterListItem } from "@/features/characters/components/character-list-item";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-store";

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
        <Stack gap={1}>
          {characters.map((character) => {
            const isSelected = selectedCharacterId === character.id;
            return (
              <Box
                key={character.id}
                p={2}
                borderRadius="md"
                cursor="pointer"
                _hover={{ bg: "surface.muted" }}
                bg={isSelected ? "surface.emphasized" : "transparent"}
                onClick={() => {
                  setSelectedCharacter(
                    selectedCharacterId === character.id ? null : character.id
                  );
                }}
              >
                <CharacterListItem character={character}>
                  {isSelected && (
                    <Box
                      height="16px"
                      width="16px"
                      layerStyle="contrast"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      borderRadius="sm"
                    >
                      <LuCheck size={12} color="white" />
                    </Box>
                  )}
                </CharacterListItem>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Text fontSize="xs" color="content.muted">
          No characters in this scenario
        </Text>
      )}
    </Box>
  );
});
