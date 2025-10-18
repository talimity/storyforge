import { Container, Spinner, Stack, Text } from "@chakra-ui/react";
import { assertDefined } from "@storyforge/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui";
import { SimplePageHeader } from "@/components/ui/page-header";
import { ScenarioDeleteDialog } from "@/features/scenarios/components/scenario-delete-dialog";
import {
  ScenarioForm,
  serializeLorebookAssignments,
} from "@/features/scenarios/components/scenario-form";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

function ScenarioEditPage() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    data: scenario,
    isPending: isLoadingScenario,
    error: loadError,
  } = useQuery(trpc.scenarios.getById.queryOptions({ id: id ?? "" }, { enabled: !!id }));

  const updateScenarioMutation = useMutation(
    trpc.scenarios.update.mutationOptions({
      onSuccess: (updatedScenario) => {
        showSuccessToast({
          title: "Scenario updated",
          description: `Changes to scenario '${updatedScenario.name}' saved.`,
        });

        queryClient.invalidateQueries(trpc.scenarios.list.pathFilter());
        if (id) {
          queryClient.invalidateQueries(trpc.scenarios.getById.queryFilter({ id }));
        }

        navigate("/scenarios");
      },
    })
  );

  const deleteScenarioMutation = useMutation(
    trpc.scenarios.delete.mutationOptions({
      onSuccess: () => {
        showSuccessToast({
          title: "Scenario deleted",
          description: `Scenario '${scenario?.name}' deleted from your library.`,
        });

        queryClient.invalidateQueries(trpc.scenarios.list.pathFilter());

        navigate("/scenarios");
      },
    })
  );

  if (isLoadingScenario) {
    return (
      <Container>
        <Stack gap={8} align="center">
          <SimplePageHeader title="Edit Scenario" tagline="Loading scenario data..." />
          <Spinner size="lg" />
        </Stack>
      </Container>
    );
  }

  if (loadError || !scenario) {
    return (
      <Container>
        <Stack gap={8} align="center">
          <SimplePageHeader
            title="Scenario Not Found"
            tagline="The requested scenario could not be found."
          />
          <Text color="fg.muted">
            {loadError?.message ||
              "The scenario you're looking for doesn't exist or has been deleted."}
          </Text>
          <Button onClick={() => navigate("/scenarios")}>Back to Scenario Library</Button>
        </Stack>
      </Container>
    );
  }

  const initialFormData = {
    name: scenario.name,
    description: scenario.description,
    participants: scenario.characters.map((participant) => ({
      characterId: participant.character.id,
      role: participant.role || undefined,
      isUserProxy: participant.isUserProxy || false,
      colorOverride:
        participant.color.toLowerCase() !== participant.character.defaultColor.toLowerCase()
          ? participant.color.toLowerCase()
          : null,
    })),
    lorebooks: scenario.lorebooks,
  };

  return (
    <>
      <Container>
        <SimplePageHeader
          title={`Edit Scenario: ${scenario.name}`}
          actions={
            <Stack direction="row" gap={2}>
              <Button
                colorPalette="red"
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleteScenarioMutation.isPending || updateScenarioMutation.isPending}
              >
                Delete Scenario
              </Button>
            </Stack>
          }
        />
        <ScenarioForm
          initialData={initialFormData}
          scenarioId={id}
          onSubmit={(vals) => {
            assertDefined(id);
            return updateScenarioMutation.mutateAsync({
              id,
              name: vals.name,
              description: vals.description,
              participants: vals.participants.map((participant) => ({
                characterId: participant.characterId,
                role: participant.role,
                isUserProxy: participant.isUserProxy,
                colorOverride: participant.colorOverride,
              })),
              lorebooks: serializeLorebookAssignments(vals.lorebooks),
            });
          }}
          onCancel={() => navigate("/scenarios")}
          submitLabel="Update Scenario"
        />
      </Container>

      <ScenarioDeleteDialog
        isOpen={showDeleteDialog}
        onOpenChange={(details) => setShowDeleteDialog(details.open)}
        scenarioName={scenario.name}
        onConfirmDelete={() => {
          if (!id) return;
          deleteScenarioMutation.mutate({ id });
          setShowDeleteDialog(false);
        }}
        isDeleting={deleteScenarioMutation.isPending}
      />
    </>
  );
}

export default ScenarioEditPage;
