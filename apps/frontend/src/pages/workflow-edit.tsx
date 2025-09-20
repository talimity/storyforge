import { Container, Skeleton } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { SimplePageHeader } from "@/components/ui";
import { WorkflowForm } from "@/features/workflows/components/builder/workflow-form";
import { useTRPC } from "@/lib/trpc";

export function WorkflowEditPage() {
  const trpc = useTRPC();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(
    trpc.workflows.getById.queryOptions(
      { id: String(id) },
      {
        enabled: Boolean(id),
        // disable automatic fetching when the window loses focus as it may
        // revert unsaved changes
        refetchOnWindowFocus: false,
      }
    )
  );
  const update = useMutation(
    trpc.workflows.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.workflows.pathFilter());
        navigate("/workflows");
      },
    })
  );

  if (isLoading)
    return (
      <Container maxW="800px">
        <SimplePageHeader title="Edit Workflow" />
        <Skeleton height="400px" borderRadius="md" />
      </Container>
    );

  if (error || !data)
    return (
      <Container maxW="800px">
        <SimplePageHeader title="Edit Workflow" />
        <Skeleton height="400px" borderRadius="md" />
      </Container>
    );

  return (
    <Container>
      <SimplePageHeader title="Edit Workflow" />
      <WorkflowForm
        initialData={{
          task: data.task,
          name: data.name,
          description: data.description,
          steps: data.steps,
        }}
        isSubmitting={update.isPending}
        submitLabel="Save"
        isEditMode
        onCancel={() => navigate("/workflows")}
        onSubmit={(vals) => update.mutate({ id: String(id), data: vals })}
      />
    </Container>
  );
}
