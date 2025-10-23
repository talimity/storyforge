import { Box, Center, Flex, HStack, Image, Stack, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuCheck, LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { Button, StreamingMarkdown } from "@/components/ui";
import { getApiUrl } from "@/lib/get-api-url";
import { useTRPC } from "@/lib/trpc";

interface CharacterStarterSelectorProps {
  enabled: boolean;
  scenarioId: string;
  onStarterSelect: (characterId: string, message: string) => void;
}

export function CharacterStarterSelector({
  enabled,
  scenarioId,
  onStarterSelect,
}: CharacterStarterSelectorProps) {
  const trpc = useTRPC();
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);
  const [currentStarterIndex, setCurrentStarterIndex] = useState(0);

  const { data } = useQuery(
    trpc.scenarios.getCharacterStarters.queryOptions({ id: scenarioId }, { enabled })
  );
  const charactersWithStarters = data?.charactersWithStarters || [];

  if (charactersWithStarters.length === 0) {
    return (
      <Box textAlign="center" color="content.muted" py={8}>
        <Text>Nothing here yet.</Text>
      </Box>
    );
  }

  const currentCharacter = charactersWithStarters[currentCharacterIndex];
  const currentStarter = currentCharacter.starters[currentStarterIndex];

  const hasMultipleCharacters = charactersWithStarters.length > 1;
  const hasMultipleStarters = currentCharacter.starters.length > 1;

  const goToPreviousCharacter = () => {
    setCurrentCharacterIndex((prev) => (prev === 0 ? charactersWithStarters.length - 1 : prev - 1));
    setCurrentStarterIndex(0); // Reset to first starter when changing character
  };

  const goToNextCharacter = () => {
    setCurrentCharacterIndex((prev) => (prev === charactersWithStarters.length - 1 ? 0 : prev + 1));
    setCurrentStarterIndex(0); // Reset to first starter when changing character
  };

  const goToPreviousStarter = () => {
    setCurrentStarterIndex((prev) =>
      prev === 0 ? currentCharacter.starters.length - 1 : prev - 1
    );
  };

  const goToNextStarter = () => {
    setCurrentStarterIndex((prev) =>
      prev === currentCharacter.starters.length - 1 ? 0 : prev + 1
    );
  };

  const handleSelect = () => {
    if (currentStarter) {
      onStarterSelect(currentCharacter.character.id, currentStarter.message);
    }
  };

  const charaImage = getApiUrl(currentCharacter.character.imagePath);

  return (
    <Box maxW="full" my={2} mx="auto" layerStyle="surface" borderRadius="lg">
      {/* Compact Character Header */}
      <Box bg="primary.solid" color="contentContrast" p={4} borderTopRadius="lg">
        <Flex align="center" justify="space-between">
          {hasMultipleCharacters && (
            <Button
              onClick={goToPreviousCharacter}
              size="md"
              variant="ghost"
              colorPalette="neutral"
              ml={2}
            >
              <LuChevronLeft />
            </Button>
          )}

          <Flex align="center" gap={4} flex="1" justify="center">
            {charaImage && (
              <Image
                src={charaImage}
                layerStyle="contrast"
                alt={currentCharacter.character.name}
                w="16"
                h="24"
                objectFit="cover"
              />
            )}
            <Box textAlign="left">
              <Text fontSize="xl" color="inherit" fontWeight="bold">
                {currentCharacter.character.name}
              </Text>
              <Text fontSize="sm" color="whiteAlpha.800">
                {currentCharacter.starters.length} starter
                {currentCharacter.starters.length !== 1 ? "s" : ""} available
              </Text>
            </Box>
          </Flex>

          {hasMultipleCharacters && (
            <Button
              onClick={goToNextCharacter}
              size="md"
              variant="ghost"
              colorPalette="neutral"
              mr={2}
            >
              <LuChevronRight />
            </Button>
          )}
        </Flex>
      </Box>

      {/* Message Area */}
      <Stack gap={4} py={4}>
        {currentStarter ? (
          <>
            {/* Starter Navigation */}
            {hasMultipleStarters && (
              <HStack justify="space-between" px={4}>
                <Flex align="center" justify="center" gap={2}>
                  <Button
                    onClick={goToPreviousStarter}
                    variant="ghost"
                    size="sm"
                    colorPalette="neutral"
                  >
                    <LuChevronLeft />
                  </Button>
                  <Text fontSize="sm" color="content.muted" px={2} aria-live="polite">
                    {currentStarterIndex + 1} of {currentCharacter.starters.length}
                  </Text>
                  <Button
                    onClick={goToNextStarter}
                    variant="ghost"
                    size="sm"
                    colorPalette="neutral"
                  >
                    <LuChevronRight />
                  </Button>
                </Flex>
                <Button onClick={handleSelect} colorPalette="primary" variant="solid" size="md">
                  <LuCheck />
                  Choose this starter
                </Button>
              </HStack>
            )}

            {/* Starter Message */}
            <Box
              bg="surface.muted"
              p={4}
              minH="xs"
              maxH="50dvh"
              overflowY="auto"
              borderTop="1px solid"
              borderBottom="1px solid"
              borderColor="border"
            >
              <StreamingMarkdown
                text={currentStarter.message}
                dialogueAuthorId={currentCharacter.character.id}
              />
            </Box>

            <Center>
              <Text fontSize="sm" color="content.muted">
                You can always edit the content later.
              </Text>
            </Center>
          </>
        ) : (
          <Box textAlign="center" py={8}>
            <Text color="content.muted">
              {currentCharacter.character.name} does not have any starters, but you can still use
              the input panel to begin the story.
            </Text>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
