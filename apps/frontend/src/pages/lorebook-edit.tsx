import { Container, Skeleton, Text } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, SimplePageHeader } from "@/components/ui";
import { toLorebookFormInitial } from "@/features/lorebooks/components/form-schemas";
import { LoreActivationPreviewDialog } from "@/features/lorebooks/components/lore-activation-preview-dialog";
import { LorebookForm } from "@/features/lorebooks/components/lorebook-form";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

export function LorebookEditPage() {
  const trpc = useTRPC();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPreview, setShowPreview] = useState(false);

  const lorebookQuery = useQuery(
    trpc.lorebooks.getById.queryOptions(
      { id: String(id) },
      {
        enabled: Boolean(id),
        refetchOnWindowFocus: false,
      }
    )
  );

  const updateMutation = useMutation(
    trpc.lorebooks.update.mutationOptions({
      onSuccess: async (result) => {
        showSuccessToast({ title: `Saved lorebook "${result.name}"` });
        await queryClient.invalidateQueries(trpc.lorebooks.pathFilter());
        navigate("/lorebooks");
      },
      onError: (error) => showErrorToast({ title: "Failed to save lorebook", error }),
    })
  );

  if (lorebookQuery.isLoading) {
    return (
      <Container>
        <SimplePageHeader title="Edit Lorebook" />
        <Skeleton height="420px" borderRadius="md" />
      </Container>
    );
  }

  if (lorebookQuery.error || !lorebookQuery.data) {
    return (
      <Container>
        <SimplePageHeader title="Edit Lorebook" />
        <Text color="fg.error">Failed to load lorebook.</Text>
      </Container>
    );
  }

  const lorebook = lorebookQuery.data.data;

  return (
    <Container>
      <SimplePageHeader
        title="Edit Lorebook"
        actions={
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            Preview in Scenario
          </Button>
        }
      />
      <LorebookForm
        initialData={toLorebookFormInitial(lorebook)}
        submitLabel="Save"
        onCancel={() => navigate("/lorebooks")}
        onSubmit={(data) => updateMutation.mutateAsync({ id: String(id), data })}
      />
      <LoreActivationPreviewDialog
        isOpen={showPreview}
        onOpenChange={setShowPreview}
        allowScenarioSelect
      />
    </Container>
  );
}
