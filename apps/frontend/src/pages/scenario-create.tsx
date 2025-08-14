import { Container } from "@chakra-ui/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ScenarioForm } from "@/components/features/scenario/scenario-form";
import { SimplePageHeader } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { showErrorToast, showSuccessToast } from "@/lib/utils/error-handling";

export function ScenarioCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const utils = trpc.useUtils();

  // Get pre-selected character IDs from URL params
  const selectedCharacterIds =
    searchParams.get("characterIds")?.split(",") || [];

  const createScenarioMutation = trpc.scenarios.create.useMutation({
    onSuccess: (scenario) => {
      showSuccessToast({
        title: "Scenario created",
        description: `${scenario.name} has been created successfully.`,
      });

      // Invalidate the scenario list cache to refresh the data
      utils.scenarios.list.invalidate();

      // Navigate back to scenario library
      navigate("/scenarios");
    },
    onError: (error) => {
      showErrorToast({
        title: "Failed to create scenario",
        error,
        fallbackMessage:
          "Unable to create the scenario. Please check your input and try again.",
      });
    },
  });

  const handleSubmit = (formData: {
    name: string;
    description: string;
    characterIds: string[];
  }) => {
    createScenarioMutation.mutate({
      name: formData.name,
      description: formData.description,
      characterIds: formData.characterIds,
    });
  };

  const handleCancel = () => {
    navigate("/scenarios");
  };

  return (
    <Container>
      <SimplePageHeader title="Create Scenario" />
      <ScenarioForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={createScenarioMutation.isPending}
        submitLabel="Create Scenario"
        initialCharacterIds={selectedCharacterIds}
      />
    </Container>
  );
}
