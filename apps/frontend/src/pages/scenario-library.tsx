import { Container, Grid, HStack } from "@chakra-ui/react";
import { createId } from "@storyforge/utils";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuBookOpen, LuImport, LuPlus } from "react-icons/lu";
import { Link, useNavigate } from "react-router-dom";
import { Button, EmptyState, ErrorEmptyState, PageHeader } from "@/components/ui";
import { ChatImportDialog } from "@/features/scenario-import/components/chat-import-dialog";
import { ScenarioCard, ScenarioCardSkeleton } from "@/features/scenarios/components/scenario-card";
import { useTRPC } from "@/lib/trpc";

export function ScenarioLibraryPage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const scenariosQuery = useQuery(trpc.scenarios.list.queryOptions({}));
  const scenarios = scenariosQuery.data?.scenarios ?? [];

  return (
    <Container>
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
        <Grid templateColumns="repeat(auto-fit, 320px)" justifyContent="center" gap={4}>
          {scenariosQuery.isLoading
            ? [...Array(15)].map(() => <ScenarioCardSkeleton key={createId()} />)
            : scenarios.map((s) => <ScenarioCard key={s.id} scenario={s} />)}
        </Grid>
      )}

      <ChatImportDialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(scenarioId) => {
          navigate(`/play/${scenarioId}`);
        }}
      />
    </Container>
  );
}
