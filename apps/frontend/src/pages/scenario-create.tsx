import { Container } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SimplePageHeader } from "@/components/ui";
import { ScenarioForm } from "@/features/scenarios/components/scenario-form";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

export function ScenarioCreatePage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const selectedCharacterIds = searchParams.get("characterIds")?.split(",") || [];

  const createScenarioMutation = useMutation(
    trpc.scenarios.create.mutationOptions({
      onSuccess: (scenario) => {
        showSuccessToast({
          title: "Scenario created",
          description: `New scenario '${scenario.name}' saved.`,
        });

        queryClient.invalidateQueries(trpc.scenarios.list.pathFilter());

        navigate("/scenarios");
      },
    })
  );

  return (
    <Container>
      <SimplePageHeader title="New Scenario" />
      <ScenarioForm
        onSubmit={async (vals) => {
          const characterIds = vals.participants.map((p) => p.characterId);
          const userProxyCharacterId = vals.participants.find((p) => p.isUserProxy)?.characterId;

          const result = await createScenarioMutation.mutateAsync({
            name: vals.name,
            description: vals.description,
            characterIds,
            userProxyCharacterId,
          });

          navigate(`/play/${result.id}`);
        }}
        onCancel={() => navigate("/scenarios")}
        submitLabel="Create Scenario"
        initialCharacterIds={selectedCharacterIds}
      />
    </Container>
  );
}
