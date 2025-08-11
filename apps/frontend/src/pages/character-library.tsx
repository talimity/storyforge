import { ActionBar, Center, Grid, Text, VStack } from "@chakra-ui/react";
import { useState } from "react";
import { LuPlay, LuUsers } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { CharacterImportDialog } from "@/components/dialogs/character-import";
import {
  CharacterCard,
  CharacterCardSkeleton,
} from "@/components/features/character/character-card";
import {
  ActionBarContent,
  Button,
  CloseButton,
  EmptyState,
  SimplePageHeader,
  SplitButton,
} from "@/components/ui";

import { trpc } from "@/lib/trpc";

export function CharacterLibraryPage() {
  const navigate = useNavigate();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(
    new Set()
  );
  const charactersQuery = trpc.characters.list.useQuery();
  const utils = trpc.useUtils();

  const toggleCharacterSelection = (characterId: string) => {
    setSelectedCharacterIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(characterId)) {
        newSet.delete(characterId);
      } else {
        newSet.add(characterId);
      }
      return newSet;
    });
  };

  const handleStartScenario = () => {
    const selectedCount = selectedCharacterIds.size;
    alert(
      `Starting scenario with ${selectedCount} character${selectedCount === 1 ? "" : "s"}`
    );
  };

  return (
    <>
      <SimplePageHeader
        title="Character Library"
        actions={[
          <SplitButton
            key="character-actions"
            buttonLabel="Import Characters"
            menuItems={[{ label: "Create New Character", value: "create" }]}
            onClick={() => setIsImportModalOpen(true)}
            onSelect={({ value }) => {
              if (value === "create") {
                navigate("/characters/create");
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
          onActionClick={() => setIsImportModalOpen(true)}
        />
      )}

      {charactersQuery.data && charactersQuery.data.characters.length > 0 && (
        <Grid
          templateColumns="repeat(auto-fit, 240px)"
          justifyContent="center"
          gap={4}
        >
          {charactersQuery.data.characters.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              isSelected={selectedCharacterIds.has(character.id)}
              onSelectionToggle={() => toggleCharacterSelection(character.id)}
            />
          ))}
        </Grid>
      )}

      <CharacterImportDialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => utils.characters.list.invalidate()}
      />

      <ActionBar.Root open={selectedCharacterIds.size > 1} closeOnEscape={true}>
        <ActionBarContent layerStyle="contrast" colorPalette="contrast">
          <ActionBar.SelectionTrigger>
            <Text>{selectedCharacterIds.size} selected</Text>
          </ActionBar.SelectionTrigger>
          <ActionBar.Separator />
          <Button
            variant="solid"
            colorPalette="accent"
            size="sm"
            onClick={handleStartScenario}
          >
            <LuPlay />
            Start New Scenario
          </Button>
          <ActionBar.CloseTrigger asChild>
            <CloseButton
              size="sm"
              colorPalette="neutral"
              onClick={() => setSelectedCharacterIds(new Set())}
            />
          </ActionBar.CloseTrigger>
        </ActionBarContent>
      </ActionBar.Root>
    </>
  );
}
