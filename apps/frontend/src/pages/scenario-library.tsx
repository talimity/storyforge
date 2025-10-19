import { Grid, HStack, Input, InputGroup, Stack } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuBookOpen, LuImport, LuPlus, LuSearch } from "react-icons/lu";
import { Link, useNavigate } from "react-router-dom";
import { Button, CloseButton, EmptyState, ErrorEmptyState, PageHeader } from "@/components/ui";
import { PageContainer } from "@/components/ui/page-container";
import { ChatImportDialog } from "@/features/scenario-import/components/chat-import-dialog";
import { ScenarioCard, ScenarioCardSkeleton } from "@/features/scenarios/components/scenario-card";
import { ScenarioFilterPopover } from "@/features/scenarios/components/scenario-filters";
import { useScenarioLibraryState } from "@/features/scenarios/hooks/use-scenario-library-state";
import { useTRPC } from "@/lib/trpc";

const scenarioSortOptions = [
  { value: "default", label: "Title" },
  { value: "createdAt", label: "Newest" },
  { value: "lastTurnAt", label: "Recently Played" },
  { value: "turnCount", label: "# Turns" },
  { value: "starred", label: "Starred" },
  { value: "participantCount", label: "Participants" },
];

const SCENARIO_SKELETON_IDS = Array.from(
  { length: 15 },
  (_, index) => `scenario-skeleton-${index}`
);

function ScenarioLibraryPage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const {
    sort,
    setSort,
    statusFilter,
    setStatusFilter,
    starredOnly,
    setStarredOnly,
    isFilterActive,
    clearFilters,
    searchInput,
    onSearchInputChange,
    clearSearch,
    queryInput,
  } = useScenarioLibraryState();

  const scenariosQuery = useQuery(trpc.scenarios.list.queryOptions(queryInput));
  const scenarios = scenariosQuery.data?.scenarios ?? [];

  return (
    <PageContainer>
      <PageHeader.Root>
        <PageHeader.Title>Scenario Library</PageHeader.Title>
        <PageHeader.Controls>
          <HStack gap={2} align="center">
            <PageHeader.Sort options={scenarioSortOptions} value={sort} onChange={setSort} />
            <ScenarioFilterPopover
              status={statusFilter}
              onStatusChange={setStatusFilter}
              starredOnly={starredOnly}
              onStarredOnlyChange={setStarredOnly}
              onClear={isFilterActive ? clearFilters : undefined}
              isDirty={isFilterActive}
            />
          </HStack>
          <HStack gap={2}>
            <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
              <LuImport />
              Import Chat
            </Button>
            <Button variant="solid" colorPalette="primary" asChild>
              <Link to="/scenarios/create">
                <LuPlus />
                Create Scenario
              </Link>
            </Button>
          </HStack>
        </PageHeader.Controls>
      </PageHeader.Root>

      <Stack
        direction={{ base: "column", md: "row" }}
        gap={3}
        align={{ base: "stretch", md: "center" }}
        justify="space-between"
        mb={4}
      >
        <InputGroup
          startElement={<LuSearch />}
          endElement={
            searchInput ? <CloseButton size="sm" onClick={clearSearch} me="-2" /> : undefined
          }
        >
          <Input
            placeholder="Search scenarios..."
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
          />
        </InputGroup>
      </Stack>

      {scenariosQuery.error ? (
        <ErrorEmptyState
          title="Failed to load scenarios"
          description={scenariosQuery.error.message}
          onActionClick={scenariosQuery.refetch}
        />
      ) : scenarios.length === 0 && !scenariosQuery.isLoading ? (
        <EmptyState
          icon={<LuBookOpen />}
          title="No scenarios yet"
          description="Add characters to a new scenario to get started."
          actionLabel="Browse Characters"
          onActionClick={() => navigate("/characters")}
        />
      ) : (
        <Grid
          templateColumns={{
            base: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))",
            md: "repeat(auto-fill, minmax(300px, 1fr))",
          }}
          justifyContent="center"
          gap={4}
        >
          {scenariosQuery.isLoading
            ? SCENARIO_SKELETON_IDS.map((id) => <ScenarioCardSkeleton key={id} />)
            : scenarios.map((scenario) => <ScenarioCard key={scenario.id} scenario={scenario} />)}
        </Grid>
      )}

      <ChatImportDialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(scenarioId) => {
          navigate(`/play/${scenarioId}`);
        }}
      />
    </PageContainer>
  );
}

export default ScenarioLibraryPage;
