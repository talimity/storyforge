import {
  Box,
  Button,
  Card,
  Center,
  EmptyState,
  Heading,
  HStack,
  Image,
  SimpleGrid,
  Skeleton,
  SkeletonText,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { LuUsers } from "react-icons/lu";
import { RiEditLine, RiPlayLine } from "react-icons/ri";
import { CharacterImportModal } from "../components/character-import-modal";
import { trpc } from "../lib/trpc";

interface CharacterCardProps {
  character: {
    id: string;
    name: string;
    description: string;
    imagePath: string | null;
  };
}

function CharacterCard({ character }: CharacterCardProps) {
  const imageUrl = character.imagePath
    ? `http://localhost:3001/api/characters/${character.id}/image`
    : null;

  const truncateDescription = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength).replace(/\s+\S*$/, "")}...`;
  };

  return (
    <Card.Root maxW="sm" variant="outline">
      <Card.Body gap={4}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={character.name}
            borderRadius="md"
            aspectRatio={4 / 3}
            fit="cover"
          />
        ) : (
          <Box
            height="200px"
            bg="gray.100"
            borderRadius="md"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="gray.500"
          >
            <LuUsers size={48} />
          </Box>
        )}
        <Box>
          <Card.Title mb={2}>{character.name}</Card.Title>
          <Card.Description>
            {truncateDescription(character.description)}
          </Card.Description>
        </Box>
      </Card.Body>
      <Card.Footer gap={2}>
        <Button variant="solid" colorPalette="blue" flex={1}>
          <RiPlayLine />
          Play
        </Button>
        <Button variant="outline" flex={1}>
          <RiEditLine />
          Edit
        </Button>
      </Card.Footer>
    </Card.Root>
  );
}

function CharacterCardSkeleton() {
  return (
    <Card.Root maxW="sm" variant="outline">
      <Card.Body gap={4}>
        <Skeleton height="200px" borderRadius="md" />
        <Box>
          <Skeleton height="6" width="60%" mb={2} />
          <SkeletonText noOfLines={2} />
        </Box>
      </Card.Body>
      <Card.Footer gap={2}>
        <Skeleton height="10" flex={1} />
        <Skeleton height="10" flex={1} />
      </Card.Footer>
    </Card.Root>
  );
}

interface EmptyCharacterListProps {
  onImportClick: () => void;
}

function EmptyCharacterList({ onImportClick }: EmptyCharacterListProps) {
  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator>
          <LuUsers />
        </EmptyState.Indicator>
        <VStack textAlign="center">
          <EmptyState.Title>No characters yet</EmptyState.Title>
          <EmptyState.Description>
            Import a character card to get started with StoryForge
          </EmptyState.Description>
        </VStack>
        <Button colorPalette="blue" onClick={onImportClick}>
          Import Character
        </Button>
      </EmptyState.Content>
    </EmptyState.Root>
  );
}

export function CharactersPage() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const charactersQuery = trpc.characters.list.useQuery();
  const utils = trpc.useUtils();

  const handleImportSuccess = () => {
    // refresh characters list after import
    utils.characters.list.invalidate();
  };

  const openImportModal = () => {
    setIsImportModalOpen(true);
  };

  return (
    <Box>
      <HStack justify="space-between" align="center" mb={6}>
        <Heading size="lg">Character Library</Heading>
        <Button variant="solid" colorPalette="blue" onClick={openImportModal}>
          Import Character
        </Button>
      </HStack>

      {charactersQuery.isLoading && (
        <SimpleGrid minChildWidth="280px" gap={6}>
          {Array.from({ length: 6 }, (_, i) => `skeleton-${i}`).map(
            (skeletonId) => (
              <CharacterCardSkeleton key={skeletonId} />
            )
          )}
        </SimpleGrid>
      )}

      {charactersQuery.error && (
        <Center p={8}>
          <VStack>
            <Text color="red.500" fontWeight="semibold">
              Failed to load characters
            </Text>
            <Text color="gray.600">{charactersQuery.error.message}</Text>
            <Button
              onClick={() => charactersQuery.refetch()}
              variant="outline"
              colorPalette="red"
            >
              Try Again
            </Button>
          </VStack>
        </Center>
      )}

      {charactersQuery.data && charactersQuery.data.characters.length === 0 && (
        <EmptyCharacterList onImportClick={openImportModal} />
      )}

      {charactersQuery.data && charactersQuery.data.characters.length > 0 && (
        <SimpleGrid minChildWidth="280px" gap={6}>
          {charactersQuery.data.characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </SimpleGrid>
      )}

      <CharacterImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </Box>
  );
}
