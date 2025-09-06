import { Box, Flex, Image, Text, VStack } from "@chakra-ui/react";
import type { CharacterWithStarters } from "@storyforge/schemas";
import { useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import Markdown from "react-markdown";
import { Button, Prose } from "@/components/ui/index";
import { getApiUrl } from "@/lib/trpc";

interface CharacterStarterSelectorProps {
  charactersWithStarters: CharacterWithStarters[];
  onStarterSelect: (characterId: string, starterId: string) => void;
}

export function CharacterStarterSelector({
  charactersWithStarters,
  onStarterSelect,
}: CharacterStarterSelectorProps) {
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);
  const [currentStarterIndex, setCurrentStarterIndex] = useState(0);

  if (charactersWithStarters.length === 0) {
    return null;
  }

  const currentCharacter = charactersWithStarters[currentCharacterIndex];
  const currentStarter = currentCharacter.starters[currentStarterIndex];

  const hasMultipleCharacters = charactersWithStarters.length > 1;
  const hasMultipleStarters = currentCharacter.starters.length > 1;

  const goToPreviousCharacter = () => {
    setCurrentCharacterIndex((prev) =>
      prev === 0 ? charactersWithStarters.length - 1 : prev - 1
    );
    setCurrentStarterIndex(0); // Reset to first starter when changing character
  };

  const goToNextCharacter = () => {
    setCurrentCharacterIndex((prev) =>
      prev === charactersWithStarters.length - 1 ? 0 : prev + 1
    );
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
      onStarterSelect(currentCharacter.character.id, currentStarter.id);
    }
  };

  const charaImage = getApiUrl(currentCharacter.character.imagePath);

  return (
    <Box maxW="full" my={2} mx="auto" layerStyle="surface" borderRadius="lg">
      {/* Compact Character Header */}
      <Box
        bg="primary.solid"
        color="contentContrast"
        p={4}
        borderTopRadius="lg"
      >
        <Flex align="center" justify="space-between">
          {hasMultipleCharacters && (
            <Button onClick={goToPreviousCharacter} variant="ghost" size="sm">
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
              ml={2}
            >
              <LuChevronRight />
            </Button>
          )}
        </Flex>
      </Box>

      {/* Full-width Message Area */}
      <Box p={6}>
        {currentStarter ? (
          <>
            {/* Starter Navigation */}
            {hasMultipleStarters && (
              <Flex align="center" justify="center" gap={2} mb={4}>
                <Button
                  onClick={goToPreviousStarter}
                  variant="ghost"
                  size="sm"
                  colorPalette="neutral"
                >
                  <LuChevronLeft />
                </Button>
                <Text
                  fontSize="sm"
                  color="content.muted"
                  px={2}
                  aria-live="polite"
                >
                  {currentStarterIndex + 1} of{" "}
                  {currentCharacter.starters.length}
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
            )}

            {/* Starter Message */}
            <Box mb={6}>
              <Box
                bg="surface.muted"
                borderRadius="lg"
                p={6}
                minH="200px"
                maxH="540px"
                overflowY="auto"
                border="1px solid"
                borderColor="border"
              >
                <Prose size="lg" maxW="66ch">
                  <Markdown>{currentStarter.message}</Markdown>
                </Prose>
              </Box>
            </Box>

            {/* Action Button */}
            <VStack>
              <Button
                onClick={handleSelect}
                colorPalette="primary"
                variant="solid"
                size="lg"
              >
                Choose this starter
              </Button>
              <Text fontSize="sm" color="content.muted" mt={2}>
                You can always edit the content later.
              </Text>
            </VStack>
          </>
        ) : (
          <Box textAlign="center" py={8}>
            <Text color="content.muted">
              {currentCharacter.character.name} does not have any starters, but
              you can still use the input panel to begin the story.
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
