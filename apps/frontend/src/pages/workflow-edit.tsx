import { Container, Skeleton } from "@chakra-ui/react";
import { useNavigate, useParams } from "react-router-dom";
import { SimplePageHeader } from "@/components/ui";
import { WorkflowForm } from "@/features/workflows/components/workflow-form";
import { trpc } from "@/lib/trpc";

export function WorkflowEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.workflows.getById.useQuery(
    { id: String(id) },
    { enabled: Boolean(id) }
  );
  const update = trpc.workflows.update.useMutation({
    onSuccess: async () => {
      await utils.workflows.invalidate();
      navigate("/workflows");
    },
  });

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
    <Container maxW="800px">
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
        onCancel={() => navigate("/workflows")}
        onSubmit={(vals) => update.mutate({ id: String(id), data: vals })}
      />
    </Container>
  );
}
