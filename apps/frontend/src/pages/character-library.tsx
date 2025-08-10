import { Center, Grid, Text, VStack } from "@chakra-ui/react";
import { useState } from "react";
import { LuUsers } from "react-icons/lu";
import { CharacterImportDialog } from "@/components/dialogs/character-import";
import {
  CharacterCard,
  CharacterCardSkeleton,
} from "@/components/features/character/character-card";
import { Button } from "@/components/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { SimplePageHeader } from "@/components/ui/page-header";
import { SplitButton } from "@/components/ui/split-button";
import { trpc } from "@/lib/trpc";

export function CharacterLibraryPage() {
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
    <>
      <SimplePageHeader
        title="Character Library"
        actions={[
          <SplitButton
            key="character-actions"
            buttonLabel="Import Characters"
            menuItems={[
              {
                label: "Create New Character",
                value: "create",
              },
            ]}
            onClick={openImportModal}
            onSelect={({ value }) => {
              if (value === "create") {
                alert("Todo");
              }
            }}
            colorPalette="primary"
            variant="solid"
          />,
        ]}
      />

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
          templateColumns="repeat(auto-fit, 240px)"
          justifyContent="center"
          gap={4}
        >
          {charactersQuery.data.characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </Grid>
      )}

      <CharacterImportDialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </>
  );
}
