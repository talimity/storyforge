import { Container } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { SimplePageHeader } from "@/components/ui";
import { WorkflowForm } from "@/features/workflows/components/workflow-form";
import { trpc } from "@/lib/trpc";

export function WorkflowCreatePage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const create = trpc.workflows.create.useMutation({
    onSuccess: async () => {
      await utils.workflows.list.invalidate();
      navigate("/workflows");
    },
  });

  return (
    <Container maxW="800px">
      <SimplePageHeader title="Create Workflow" />
      <WorkflowForm
        isSubmitting={create.isPending}
        submitLabel="Create"
        onCancel={() => navigate("/workflows")}
        onSubmit={(data) => create.mutate(data)}
      />
    </Container>
  );
}
