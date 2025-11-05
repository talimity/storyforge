import { ActionBar, Box, Container, Flex, Grid, Input, InputGroup } from "@chakra-ui/react";
import type { CardType, CharacterLibraryItem } from "@storyforge/contracts";
import { createId } from "@storyforge/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type MouseEventHandler, useState } from "react";
import { LuLayoutGrid, LuLayoutList, LuPlay, LuSearch, LuUsersRound } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import {
  ActionBarContent,
  Button,
  CloseButton,
  EmptyState,
  ErrorEmptyState,
  PageHeader,
  SortDropdown,
  SplitButton,
  ViewModes,
} from "@/components/ui";
import { PageContainer } from "@/components/ui/page-container";
import {
  CharacterCard,
  CharacterCardSkeleton,
} from "@/features/characters/components/character-card";
import { CharacterFilterPopover } from "@/features/characters/components/character-filters";
import { CharacterImportDialog } from "@/features/characters/components/character-import-dialog";
import { CharacterPile } from "@/features/characters/components/character-pile";
import {
  CompactCharacterCard,
  CompactCharacterCardSkeleton,
} from "@/features/characters/components/compact-character-card";
import {
  characterFilterParams,
  characterFilterStorageKey,
  characterFilterVersion,
  characterLibraryFilterDefaults,
  characterLibraryFilterSchema,
  createCharacterQueryInput,
  parseCharacterSort,
  parseCharacterViewMode,
} from "@/features/characters/library/filters";
import { usePersistedLibraryFilters } from "@/features/library/use-persisted-library-filters";
import { useTRPC } from "@/lib/trpc";

const viewModeOptions = [
  { value: "grid", label: <LuLayoutGrid /> },
  { value: "list", label: <LuLayoutList /> },
];

const characterSortOptions = [
  { value: "default", label: "Default" },
  { value: "createdAt", label: "Newest" },
  { value: "lastTurnAt", label: "Recently Played" },
  { value: "turnCount", label: "Turns Authored" },
];

const GRID_SKELETON_IDS = Array.from({ length: 20 }, () => createId());
const LIST_SKELETON_IDS = Array.from({ length: 20 }, () => createId());

function CharacterLibraryPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const { filters, deferredFilters, setFilter, updateFilters } = usePersistedLibraryFilters({
    schema: characterLibraryFilterSchema,
    defaults: characterLibraryFilterDefaults,
    params: characterFilterParams,
    storageKey: characterFilterStorageKey,
    version: characterFilterVersion,
  });
  const charaQueryInput = createCharacterQueryInput(deferredFilters);
  const charaQuery = useQuery(trpc.characters.list.queryOptions(charaQueryInput));
  const charas = charaQuery.data?.characters ?? [];

  const clearSearch = () => {
    setFilter("search", "");
  };

  const handleSearchChange = (next: string) => {
    setFilter("search", next);
  };

  const handleSortChange = (next: string) => {
    const parsed = parseCharacterSort(next);
    if (!parsed.success) {
      return;
    }
    setFilter("sort", parsed.data);
  };

  const handleViewModeChange = (next: string) => {
    const parsed = parseCharacterViewMode(next);
    if (!parsed.success) {
      return;
    }
    setFilter("viewMode", parsed.data);
  };

  const handleActorTypesChange = (next: CardType[]) => {
    setFilter("actorTypes", next);
  };

  const handleStarredOnlyChange = (next: boolean) => {
    setFilter("starredOnly", next);
  };

  const clearFilterSelections = () => {
    updateFilters((previous) => {
      const raw: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(previous)) {
        if (key === "actorTypes") {
          raw[key] = [];
        } else if (key === "starredOnly") {
          raw[key] = false;
        } else {
          raw[key] = value;
        }
      }
      return characterLibraryFilterSchema.parse(raw);
    });
  };

  const isFilterActive = filters.actorTypes.length > 0 || filters.starredOnly;

  const toggleCharacterSelection = (characterId: string) => {
    setSelectedCharacterIds((previous) => {
      if (previous.includes(characterId)) {
        return previous.filter((id) => id !== characterId);
      }
      return [...previous, characterId];
    });
  };

  const handleLibraryClick: MouseEventHandler<HTMLElement> = (event) => {
    const target = event.target as HTMLElement | null;
    const cardEl = target?.closest<HTMLElement>("[data-character-id]");
    if (!cardEl) {
      return;
    }
    const id = cardEl.getAttribute("data-character-id");
    if (!id) {
      return;
    }
    toggleCharacterSelection(id);
  };

  const handleStartScenario = () => {
    if (selectedCharacterIds.length < 2) {
      return;
    }
    const params = new URLSearchParams();
    params.set("characterIds", selectedCharacterIds.join(","));
    navigate(`/scenarios/create?${params.toString()}`);
  };

  const selectedCharacters = getSelectedCharacters(charas, selectedCharacterIds);

  return (
    <>
      <PageContainer>
        <PageHeader.Root>
          <PageHeader.Title>Character Library</PageHeader.Title>
          <PageHeader.Controls>
            <SplitButton
              buttonLabel="Create Character"
              menuItems={[
                { label: "New Character", value: "create", path: "/characters/create" },
                { label: "Import Character", value: "import" },
              ]}
              onSelect={({ value }) => {
                if (value === "import") {
                  setIsImportModalOpen(true);
                }
              }}
              colorPalette="primary"
              variant="solid"
            />
          </PageHeader.Controls>
        </PageHeader.Root>

        <Flex wrap="wrap" gap={2} mb={4}>
          <Box flex="999 1 240px" minW="240px">
            <InputGroup
              startElement={<LuSearch />}
              endElement={
                filters.search ? <CloseButton size="xs" onClick={clearSearch} me="-2" /> : undefined
              }
            >
              <Input
                placeholder="Search characters..."
                value={filters.search}
                onChange={(event) => handleSearchChange(event.target.value)}
              />
            </InputGroup>
          </Box>
          <Flex flex="1" gap={2}>
            <SortDropdown
              options={characterSortOptions}
              value={filters.sort}
              onChange={handleSortChange}
            />
            <CharacterFilterPopover
              actorTypes={filters.actorTypes}
              onActorTypesChange={handleActorTypesChange}
              starredOnly={filters.starredOnly}
              onStarredOnlyChange={handleStarredOnlyChange}
              onClear={isFilterActive ? clearFilterSelections : undefined}
              isDirty={isFilterActive}
            />
            <ViewModes
              options={viewModeOptions}
              value={filters.viewMode}
              onChange={handleViewModeChange}
            />
          </Flex>
        </Flex>

        {charaQuery.error ? (
          <ErrorEmptyState
            title="Failed to load characters"
            description={charaQuery.error.message}
            onActionClick={charaQuery.refetch}
          />
        ) : charas.length === 0 && !charaQuery.isLoading ? (
          <EmptyState
            icon={<LuUsersRound />}
            title="No characters yet"
            description="Import a character card to get started with StoryForge"
            actionLabel="Import Character"
            onActionClick={() => setIsImportModalOpen(true)}
          />
        ) : filters.viewMode === "grid" ? (
          <CharaGridView
            characters={charas}
            isLoading={charaQuery.isLoading}
            onCardClick={toggleCharacterSelection}
            selectedCharacterIds={selectedCharacterIds}
          />
        ) : (
          <Grid
            templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
            gap={3}
            onClick={handleLibraryClick}
          >
            {charaQuery.isLoading
              ? LIST_SKELETON_IDS.map((skeletonId) => (
                  <CompactCharacterCardSkeleton key={skeletonId} />
                ))
              : charas.map((character) => (
                  <CompactCharacterCard
                    key={character.id}
                    character={character}
                    isSelected={selectedCharacterIds.includes(character.id)}
                  />
                ))}
          </Grid>
        )}
      </PageContainer>

      <CharacterImportDialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => qc.invalidateQueries(trpc.characters.list.pathFilter())}
      />
      <ActionBar.Root open={selectedCharacterIds.length > 1} closeOnEscape>
        <ActionBarContent layerStyle="contrast" colorPalette="contrast">
          <Container>
            <Flex align="center">
              <CharacterPile
                characters={selectedCharacters}
                maxAvatars={3}
                size="xs"
                layerStyle="contrast"
                shape="rounded"
              />
            </Flex>
          </Container>
          <ActionBar.Separator />
          <Button variant="solid" colorPalette="accent" size="sm" onClick={handleStartScenario}>
            <LuPlay />
            Start New Scenario
          </Button>
          <ActionBar.CloseTrigger asChild>
            <CloseButton
              size="sm"
              colorPalette="neutral"
              onClick={() => setSelectedCharacterIds([])}
            />
          </ActionBar.CloseTrigger>
        </ActionBarContent>
      </ActionBar.Root>
    </>
  );
}

export default CharacterLibraryPage;

function CharaGridView(props: {
  characters: CharacterLibraryItem[];
  selectedCharacterIds: string[];
  isLoading: boolean;
  onCardClick: (characterId: string) => void;
}) {
  const { characters, isLoading, onCardClick, selectedCharacterIds } = props;

  return (
    <Grid
      templateColumns={{
        base: "repeat(auto-fit, minmax(130px, 1fr))",
        sm: "repeat(auto-fit, minmax(165px, 1fr))",
        md: "repeat(auto-fit, minmax(180px, 1fr))",
        lg: "repeat(auto-fit, minmax(220px, 1fr))",
        "2xl": "repeat(auto-fill, 250px)",
      }}
      justifyContent="center"
      gap={4}
      onClick={(event) => {
        const target = event.target as HTMLElement | null;
        const cardEl = target?.closest<HTMLElement>("[data-character-id]");
        if (!cardEl) return;
        const id = cardEl.getAttribute("data-character-id");
        if (!id) return;
        onCardClick(id);
      }}
    >
      {isLoading
        ? GRID_SKELETON_IDS.map((skeletonId) => <CharacterCardSkeleton key={skeletonId} />)
        : characters.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              isSelected={selectedCharacterIds.includes(character.id)}
            />
          ))}
    </Grid>
  );
}

function getSelectedCharacters(characters: CharacterLibraryItem[], selectedCharacterIds: string[]) {
  if (!characters) return [];
  return selectedCharacterIds
    .map((id) => characters.find((char) => char.id === id))
    .filter((char): char is NonNullable<typeof char> => char !== undefined);
}
