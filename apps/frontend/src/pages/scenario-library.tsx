import { Box, Flex, Grid, HStack, Input, InputGroup } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuBookOpen, LuImport, LuPlus, LuSearch } from "react-icons/lu";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  CloseButton,
  EmptyState,
  ErrorEmptyState,
  PageHeader,
  SortDropdown,
} from "@/components/ui";
import { PageContainer } from "@/components/ui/page-container";
import { usePersistedLibraryFilters } from "@/features/library/use-persisted-library-filters";
import { ChatImportDialog } from "@/features/scenario-import/components/chat-import-dialog";
import { ScenarioCard, ScenarioCardSkeleton } from "@/features/scenarios/components/scenario-card";
import {
  ScenarioFilterPopover,
  type ScenarioStatusFilter,
} from "@/features/scenarios/components/scenario-filters";
import {
  createScenarioQueryInput,
  parseScenarioSort,
  scenarioFilterParams,
  scenarioFilterStorageKey,
  scenarioFilterVersion,
  scenarioLibraryFilterDefaults,
  scenarioLibraryFilterSchema,
} from "@/features/scenarios/library/filters";
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
  const { filters, setFilter, updateFilters } = usePersistedLibraryFilters({
    schema: scenarioLibraryFilterSchema,
    defaults: scenarioLibraryFilterDefaults,
    params: scenarioFilterParams,
    storageKey: scenarioFilterStorageKey,
    version: scenarioFilterVersion,
  });
  const scenariosQueryInput = createScenarioQueryInput(filters);
  const scenariosQuery = useQuery(trpc.scenarios.list.queryOptions(scenariosQueryInput));
  const scenarios = scenariosQuery.data?.scenarios ?? [];
  const isFilterActive = filters.status !== "all" || filters.starredOnly;

  const clearSearch = () => {
    setFilter("search", "");
  };

  const handleSearchChange = (next: string) => {
    setFilter("search", next);
  };

  const handleSortChange = (next: string) => {
    const parsed = parseScenarioSort(next);
    if (!parsed.success) {
      return;
    }
    setFilter("sort", parsed.data);
  };

  const handleStatusChange = (next: ScenarioStatusFilter) => {
    setFilter("status", next);
  };

  const handleStarredOnlyChange = (next: boolean) => {
    setFilter("starredOnly", next);
  };

  const clearFilterSelections = () => {
    updateFilters((previous) => {
      const raw: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(previous)) {
        if (key === "status") {
          raw[key] = "all";
        } else if (key === "starredOnly") {
          raw[key] = false;
        } else {
          raw[key] = value;
        }
      }
      return scenarioLibraryFilterSchema.parse(raw);
    });
  };

  return (
    <PageContainer>
      <PageHeader.Root>
        <PageHeader.Title>Scenario Library</PageHeader.Title>
        <PageHeader.Controls>
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

      <Flex wrap="wrap" gap={2} mb={4}>
        <Box flex="999 1 240px" minW="240px">
          <InputGroup
            startElement={<LuSearch />}
            endElement={
              filters.search ? <CloseButton size="sm" onClick={clearSearch} me="-2" /> : undefined
            }
          >
            <Input
              placeholder="Search scenarios..."
              value={filters.search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </InputGroup>
        </Box>
        <Flex flex="1" gap={2}>
          <SortDropdown
            options={scenarioSortOptions}
            value={filters.sort}
            onChange={handleSortChange}
          />
          <ScenarioFilterPopover
            status={filters.status}
            onStatusChange={handleStatusChange}
            starredOnly={filters.starredOnly}
            onStarredOnlyChange={handleStarredOnlyChange}
            onClear={isFilterActive ? clearFilterSelections : undefined}
            isDirty={isFilterActive}
          />
        </Flex>
      </Flex>

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
