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

  const selectedCharacterIds =
    searchParams.get("characterIds")?.split(",") || [];

  const createScenarioMutation = trpc.scenarios.create.useMutation({
    onSuccess: (scenario) => {
      showSuccessToast({
        title: "Scenario created",
        description: `${scenario.name} has been created successfully.`,
      });

      utils.scenarios.list.invalidate();

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
    participants: Array<{
      characterId: string;
      role?: string;
      isUserProxy?: boolean;
    }>;
  }) => {
    const characterIds = formData.participants.map((p) => p.characterId);
    const userProxyCharacterId = formData.participants.find(
      (p) => p.isUserProxy
    )?.characterId;

    createScenarioMutation.mutate({
      name: formData.name,
      description: formData.description,
      characterIds,
      userProxyCharacterId,
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
