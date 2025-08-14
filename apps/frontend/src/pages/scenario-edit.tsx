import { Container, Spinner, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ScenarioDeleteDialog } from "@/components/dialogs/scenario-delete";
import { ScenarioForm } from "@/components/features/scenario/scenario-form";
import { Button } from "@/components/ui";
import { SimplePageHeader } from "@/components/ui/page-header";
import { trpc } from "@/lib/trpc";
import { showErrorToast, showSuccessToast } from "@/lib/utils/error-handling";

export function ScenarioEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch scenario data
  const {
    data: scenario,
    isPending: isLoadingScenario,
    error: loadError,
  } = trpc.scenarios.getById.useQuery({ id: id ?? "" }, { enabled: !!id });

  // Update mutation
  const updateScenarioMutation = trpc.scenarios.update.useMutation({
    onSuccess: (updatedScenario) => {
      showSuccessToast({
        title: "Scenario updated",
        description: `Your changes to ${updatedScenario.name} have been saved.`,
      });

      // Invalidate the scenario list and detail cache to refresh the data
      utils.scenarios.list.invalidate();
      if (id) {
        utils.scenarios.getById.invalidate({ id });
      }

      // Navigate back to scenario library
      navigate("/scenarios");
    },
    onError: (error) => {
      showErrorToast({
        title: "Failed to update scenario",
        error,
        fallbackMessage:
          "Unable to update the scenario. Please check your input and try again.",
      });
    },
  });

  // Delete mutation
  const deleteScenarioMutation = trpc.scenarios.delete.useMutation({
    onSuccess: () => {
      showSuccessToast({
        title: "Scenario deleted",
        description: "The scenario has been deleted successfully.",
      });

      // Invalidate the scenario list cache to refresh the data
      utils.scenarios.list.invalidate();

      // Navigate back to scenario library
      navigate("/scenarios");
    },
    onError: (error) => {
      showErrorToast({
        title: "Failed to delete scenario",
        error,
        fallbackMessage: "Unable to delete the scenario. Please try again.",
      });
    },
  });

  // Handle form submission
  const handleSubmit = (formData: {
    name: string;
    description: string;
    characterIds: string[];
  }) => {
    if (!id) return;

    updateScenarioMutation.mutate({
      id,
      name: formData.name,
      description: formData.description,
      // Note: character assignments are handled separately through character management
    });
  };

  // Handle cancel
  const handleCancel = () => {
    navigate("/scenarios");
  };

  // Handle delete with confirmation
  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (!id) return;
    deleteScenarioMutation.mutate({ id });
    setShowDeleteDialog(false);
  };

  // Loading state
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

  // Error state (scenario not found)
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

  // Transform scenario data for form
  const initialFormData = {
    name: scenario.name,
    description: scenario.description,
    characterIds: scenario.characters.map(
      (assignment) => assignment.character.id
    ),
  };

  return (
    <>
      <Container>
        <SimplePageHeader
          title="Edit Scenario"
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
