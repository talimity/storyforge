import {
  Center,
  Container,
  Grid,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { LuBookOpen, LuFileText } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { ChatImportDialog } from "@/components/dialogs/chat-import";
import { ScenarioCard } from "@/components/features/scenario/scenario-card";
import { Button, EmptyState, PageHeader } from "@/components/ui";

import { trpc } from "@/lib/trpc";

export function ScenarioLibraryPage() {
  const navigate = useNavigate();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const scenariosQuery = trpc.scenarios.list.useQuery({});

  return (
    <Container>
      <PageHeader.Root>
        <PageHeader.Title>Scenario Library</PageHeader.Title>
        <PageHeader.Controls>
          <HStack gap={2}>
            <Button
              variant="outline"
              onClick={() => setIsImportModalOpen(true)}
            >
              <LuFileText />
              Import Chat
            </Button>
            <Button
              variant="solid"
              colorPalette="primary"
              onClick={() => navigate("/scenarios/create")}
            >
              Create Scenario
            </Button>
          </HStack>
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
          icon={<LuBookOpen />}
          title="No scenarios yet"
          description="Add characters to a new scenario to get started."
          actionLabel="Browse Characters"
          onActionClick={() => navigate("/characters")}
        />
      )}

      {Number(scenariosQuery.data?.scenarios.length) > 0 && (
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

      <ChatImportDialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(scenarioId) => {
          navigate(`/scenarios/${scenarioId}`);
        }}
      />
    </Container>
  );
}
