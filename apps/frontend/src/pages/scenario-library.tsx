import { Center, Container, Grid, Text, VStack } from "@chakra-ui/react";
import { LuPlay } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { ScenarioCard } from "@/components/features/scenario/scenario-card";
import { Button, EmptyState, PageHeader } from "@/components/ui";

import { trpc } from "@/lib/trpc";

export function ScenarioLibraryPage() {
  const navigate = useNavigate();
  const scenariosQuery = trpc.scenarios.list.useQuery({});

  return (
    <Container>
      <PageHeader.Root>
        <PageHeader.Title>Scenario Library</PageHeader.Title>
        <PageHeader.Controls>
          <Button
            variant="solid"
            colorPalette="primary"
            onClick={() => navigate("/scenarios/create")}
          >
            Create Scenario
          </Button>
        </PageHeader.Controls>
      </PageHeader.Root>

      {scenariosQuery.isLoading && (
        <Grid
          templateColumns="repeat(auto-fit, 320px)"
          justifyContent="center"
          gap={4}
        >
          {Array.from({ length: 6 }, (_, i) => `skeleton-${i}`).map(
            (skeletonId) => (
              <div key={skeletonId}>Loading...</div>
            )
          )}
        </Grid>
      )}

      {scenariosQuery.error && (
        <Center p={8}>
          <VStack>
            <Text color="red.500" fontWeight="semibold">
              Failed to load scenarios
            </Text>
            <Text color="gray.600">{scenariosQuery.error.message}</Text>
            <Button
              onClick={() => scenariosQuery.refetch()}
              variant="outline"
              colorPalette="red"
            >
              Try Again
            </Button>
          </VStack>
        </Center>
      )}

      {scenariosQuery.data?.scenarios.length === 0 && (
        <EmptyState
          icon={<LuPlay />}
          title="No scenarios yet"
          description="Create your first scenario by selecting characters and clicking 'Start New Scenario'"
          actionLabel="Browse Characters"
          onActionClick={() => navigate("/characters")}
        />
      )}

      {scenariosQuery.data?.scenarios.length && (
        <Grid
          templateColumns="repeat(auto-fit, 320px)"
          justifyContent="center"
          gap={4}
        >
          {scenariosQuery.data?.scenarios.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </Grid>
      )}
    </Container>
  );
}
