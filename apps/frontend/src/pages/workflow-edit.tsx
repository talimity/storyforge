import { Container, Skeleton } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { SimplePageHeader } from "@/components/ui";
import { PageContainer } from "@/components/ui/page-container";
import { WorkflowForm } from "@/features/workflows/components/builder/workflow-form";
import { useTRPC } from "@/lib/trpc";

function WorkflowEditPage() {
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
    <PageContainer>
      <SimplePageHeader title={`Edit Workflow: ${data.name}`} />
      <WorkflowForm
        initialData={{
          task: data.task,
          name: data.name,
          description: data.description,
          steps: data.steps,
        }}
        submitLabel="Save"
        isEditMode
        onCancel={() => navigate("/workflows")}
        onSubmit={(vals) => update.mutateAsync({ id: String(id), data: vals })}
      />
    </PageContainer>
  );
}

export default WorkflowEditPage;
