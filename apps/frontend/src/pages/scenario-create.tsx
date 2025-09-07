import { Container } from "@chakra-ui/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SimplePageHeader } from "@/components/ui";
import { ScenarioForm } from "@/features/scenarios/components/scenario-form";
import { showSuccessToast } from "@/lib/error-handling";
import { trpc } from "@/lib/trpc";

export function ScenarioCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const utils = trpc.useUtils();

  const selectedCharacterIds = searchParams.get("characterIds")?.split(",") || [];

  const createScenarioMutation = trpc.scenarios.create.useMutation({
    onSuccess: (scenario) => {
      showSuccessToast({
        title: "Scenario created",
        description: `New scenario '${scenario.name}' saved.`,
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
    const characterIds = formData.participants.map((p) => p.characterId);
    const userProxyCharacterId = formData.participants.find((p) => p.isUserProxy)?.characterId;

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
      <SimplePageHeader title="New Scenario" />
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
