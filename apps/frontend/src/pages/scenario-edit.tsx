import { Container, Spinner, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ScenarioDeleteDialog } from "@/components/dialogs/scenario-delete";
import { ScenarioForm } from "@/components/features/scenario/scenario-form";
import { Button } from "@/components/ui";
import { SimplePageHeader } from "@/components/ui/page-header";
import { trpc } from "@/lib/trpc";
import { showSuccessToast } from "@/lib/utils/error-handling";

export function ScenarioEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    data: scenario,
    isPending: isLoadingScenario,
    error: loadError,
  } = trpc.scenarios.getById.useQuery({ id: id ?? "" }, { enabled: !!id });

  const updateScenarioMutation = trpc.scenarios.update.useMutation({
    onSuccess: (updatedScenario) => {
      showSuccessToast({
        title: "Scenario updated",
        description: `Changes to scenario '${updatedScenario.name}' saved.`,
      });

      utils.scenarios.list.invalidate();
      if (id) {
        utils.scenarios.getById.invalidate({ id });
      }

      navigate("/scenarios");
    },
  });

  const deleteScenarioMutation = trpc.scenarios.delete.useMutation({
    onSuccess: () => {
      showSuccessToast({
        title: "Scenario deleted",
        description: `Scenario '${scenario?.name}' deleted from your library.`,
      });

      utils.scenarios.list.invalidate();

      navigate("/scenarios");
    },
  });

  const handleSubmit = (formData: {
    name: string;
    description: string;
    participants: Array<{
      characterId: string;
      role?: string;
      isUserProxy?: boolean;
    }>;
  }) => {
    if (!id) return;

    updateScenarioMutation.mutate({
      id,
      name: formData.name,
      description: formData.description,
      participants: formData.participants,
    });
  };

  const handleCancel = () => {
    navigate("/scenarios");
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (!id) return;
    deleteScenarioMutation.mutate({ id });
    setShowDeleteDialog(false);
  };

  if (isLoadingScenario) {
    return (
      <Container>
        <Stack gap={8} align="center">
          <SimplePageHeader
            title="Edit Scenario"
            tagline="Loading scenario data..."
          />
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
          <Button onClick={() => navigate("/scenarios")}>
            Back to Scenario Library
          </Button>
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
    })),
  };

  return (
    <>
      <Container>
        <SimplePageHeader
          title={scenario.name}
          actions={
            <Button
              colorPalette="red"
              variant="outline"
              onClick={handleDelete}
              disabled={
                deleteScenarioMutation.isPending ||
                updateScenarioMutation.isPending
              }
            >
              Delete Scenario
            </Button>
          }
        />
        <ScenarioForm
          initialData={initialFormData}
          scenarioId={id}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={updateScenarioMutation.isPending}
          submitLabel="Update Scenario"
        />
      </Container>

      <ScenarioDeleteDialog
        isOpen={showDeleteDialog}
        onOpenChange={(details) => setShowDeleteDialog(details.open)}
        scenarioName={scenario.name}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={deleteScenarioMutation.isPending}
      />
    </>
  );
}
