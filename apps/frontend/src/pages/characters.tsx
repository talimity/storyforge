import {
  Box,
  Button,
  Center,
  Grid,
  Heading,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { LuUsers } from "react-icons/lu";
import { CharacterImportModal } from "@/components/character-import-modal";
import {
  CharacterCard,
  CharacterCardSkeleton,
} from "@/components/features/character/character-card";
import { EmptyState } from "@/components/ui/empty-state";
import { trpc } from "@/lib/trpc";

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
        <Grid
          templateColumns={{
            base: "repeat(auto-fill, 240px)",
            sm: "repeat(auto-fill, 240px)",
            md: "repeat(auto-fill, 240px)",
            lg: "repeat(auto-fill, 240px)",
          }}
          gap={4}
          justifyContent="start"
        >
          {Array.from({ length: 8 }, (_, i) => `skeleton-${i}`).map(
            (skeletonId) => (
              <CharacterCardSkeleton key={skeletonId} />
            )
          )}
        </Grid>
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
        <EmptyState
          icon={<LuUsers />}
          title="No characters yet"
          description="Import a character card to get started with StoryForge"
          actionLabel="Import Character"
          onActionClick={openImportModal}
        />
      )}

      {charactersQuery.data && charactersQuery.data.characters.length > 0 && (
        <Grid
          templateColumns={{
            base: "repeat(auto-fill, 240px)",
            sm: "repeat(auto-fill, 240px)",
            md: "repeat(auto-fill, 240px)",
            lg: "repeat(auto-fill, 240px)",
          }}
          gap={4}
          justifyContent="start"
        >
          {charactersQuery.data.characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </Grid>
      )}

      <CharacterImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </Box>
  );
}
