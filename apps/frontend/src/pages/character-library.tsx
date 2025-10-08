import { ActionBar, Container, Flex, Grid } from "@chakra-ui/react";
import type { CharacterSummary } from "@storyforge/contracts";
import { createId } from "@storyforge/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LuLayoutGrid, LuLayoutList, LuPlay, LuUsersRound } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import {
  ActionBarContent,
  Button,
  CloseButton,
  EmptyState,
  ErrorEmptyState,
  PageHeader,
  SplitButton,
} from "@/components/ui";
import {
  CharacterCard,
  CharacterCardSkeleton,
} from "@/features/characters/components/character-card";
import { CharacterImportDialog } from "@/features/characters/components/character-import-dialog";
import { CharacterPile } from "@/features/characters/components/character-pile";
import {
  CompactCharacterCard,
  CompactCharacterCardSkeleton,
} from "@/features/characters/components/compact-character-card";
import { useTRPC } from "@/lib/trpc";

const viewModeOptions = [
  { value: "list", label: <LuLayoutList /> },
  { value: "grid", label: <LuLayoutGrid /> },
];

export function CharacterLibraryPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    const saved = localStorage.getItem("character-library-view-mode");
    return saved !== null ? JSON.parse(saved) : "grid";
  });
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const charaQuery = useQuery(trpc.characters.list.queryOptions());
  const charas = charaQuery.data?.characters || [];

  // Persist view mode to localStorage
  useEffect(() => {
    localStorage.setItem("character-library-view-mode", JSON.stringify(viewMode));
  }, [viewMode]);

  const toggleCharacterSelection = (characterId: string) => {
    setSelectedCharacterIds((prev) => {
      if (prev.includes(characterId)) {
        return prev.filter((id) => id !== characterId);
      } else {
        return [...prev, characterId];
      }
    });
  };

  // Delegate clicks from the card grid/list to avoid per-card handler props
  const handleLibraryClick: React.MouseEventHandler<HTMLElement> = (e) => {
    const target = e.target as HTMLElement | null;
    const cardEl = target?.closest<HTMLElement>("[data-character-id]");
    if (!cardEl) return;
    const id = cardEl.getAttribute("data-character-id");
    if (!id) return;
    toggleCharacterSelection(id);
  };

  const handleStartScenario = () => {
    const params = new URLSearchParams();
    params.set("characterIds", selectedCharacterIds.join(","));
    navigate(`/scenarios/create?${params.toString()}`);
  };

  const selectedCharacters = getSelectedCharacters(charas, selectedCharacterIds);

  return (
    <>
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
        ) : viewMode === "grid" ? (
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
              ? [...Array(20)].map(() => <CompactCharacterCardSkeleton key={createId()} />)
              : charas.map((c) => (
                  <CompactCharacterCard
                    key={c.id}
                    character={c}
                    isSelected={selectedCharacterIds.includes(c.id)}
                  />
                ))}
          </Grid>
        )}
      </Container>

      <CharacterImportDialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => qc.invalidateQueries(trpc.characters.list.pathFilter())}
      />
      <ActionBar.Root open={selectedCharacterIds.length > 1} closeOnEscape={true}>
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

function CharaGridView(props: {
  characters: CharacterSummary[];
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
      onClick={(e) => {
        const target = e.target as HTMLElement | null;
        const cardEl = target?.closest<HTMLElement>("[data-character-id]");
        if (!cardEl) return;
        const id = cardEl.getAttribute("data-character-id");
        if (!id) return;
        onCardClick(id);
      }}
    >
      {isLoading
        ? Array.from({ length: 20 }, (_, i) => `skeleton-${i}`).map((skeletonId) => (
            <CharacterCardSkeleton key={skeletonId} />
          ))
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

function getSelectedCharacters(characters: CharacterSummary[], selectedCharacterIds: string[]) {
  if (!characters) return [];
  return selectedCharacterIds
    .map((id) => characters.find((char) => char.id === id))
    .filter((char): char is NonNullable<typeof char> => char !== undefined);
}
