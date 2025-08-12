import {
  ActionBar,
  Center,
  Container,
  Grid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import {
  LuLayoutGrid,
  LuLayoutList,
  LuPlay,
  LuUsersRound,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { CharacterImportDialog } from "@/components/dialogs/character-import";
import {
  CharacterCard,
  CharacterCardSkeleton,
} from "@/components/features/character/character-card";
import {
  CompactCharacterCard,
  CompactCharacterCardSkeleton,
} from "@/components/features/character/compact-character-card";
import {
  ActionBarContent,
  Button,
  CloseButton,
  EmptyState,
  PageHeader,
  SplitButton,
} from "@/components/ui";

import { trpc } from "@/lib/trpc";

export function CharacterLibraryPage() {
  const navigate = useNavigate();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    const saved = localStorage.getItem("character-library-view-mode");
    return saved !== null ? JSON.parse(saved) : "grid";
  });
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(
    new Set()
  );
  const charactersQuery = trpc.characters.list.useQuery();
  const utils = trpc.useUtils();

  // Persist view mode to localStorage
  useEffect(() => {
    localStorage.setItem(
      "character-library-view-mode",
      JSON.stringify(viewMode)
    );
  }, [viewMode]);

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

  const viewModeOptions = [
    { value: "list", label: <LuLayoutList /> },
    { value: "grid", label: <LuLayoutGrid /> },
  ];

  return (
    <Container>
      <PageHeader.Root>
        <PageHeader.Title>Character Library</PageHeader.Title>
        <PageHeader.Controls>
          <PageHeader.ViewModes
            options={viewModeOptions}
            defaultValue={viewMode}
            onChange={(value) => setViewMode(value as "grid" | "list")}
          />
          <SplitButton
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
          />
        </PageHeader.Controls>
      </PageHeader.Root>

      {charactersQuery.isLoading &&
        (viewMode === "grid" ? (
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
        ) : (
          <Grid
            templateColumns={{
              base: "1fr",
              sm: "repeat(2, 1fr)",
            }}
            gap={3}
          >
            {Array.from({ length: 8 }, (_, i) => `skeleton-${i}`).map(
              (skeletonId) => (
                <CompactCharacterCardSkeleton key={skeletonId} />
              )
            )}
          </Grid>
        ))}

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
          icon={<LuUsersRound />}
          title="No characters yet"
          description="Import a character card to get started with StoryForge"
          actionLabel="Import Character"
          onActionClick={() => setIsImportModalOpen(true)}
        />
      )}

      {charactersQuery.data &&
        charactersQuery.data.characters.length > 0 &&
        (viewMode === "grid" ? (
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
        ) : (
          <Grid
            templateColumns={{
              base: "1fr",
              md: "repeat(2, 1fr)",
            }}
            gap={3}
          >
            {charactersQuery.data.characters.map((character) => (
              <CompactCharacterCard
                key={character.id}
                character={character}
                isSelected={selectedCharacterIds.has(character.id)}
                onSelectionToggle={() => toggleCharacterSelection(character.id)}
              />
            ))}
          </Grid>
        ))}

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
    </Container>
  );
}
