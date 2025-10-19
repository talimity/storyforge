import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { SimplePageHeader } from "@/components/ui";
import { PageContainer } from "@/components/ui/page-container";
import { WorkflowForm } from "@/features/workflows/components/builder/workflow-form";
import { useTRPC } from "@/lib/trpc";

function WorkflowCreatePage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useMutation(
    trpc.workflows.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.workflows.list.pathFilter());
        navigate("/workflows");
      },
    })
  );

  return (
    <PageContainer>
      <SimplePageHeader title="Create Workflow" />
      <WorkflowForm
        submitLabel="Create Workflow"
        onCancel={() => navigate("/workflows")}
        onSubmit={(data) => create.mutateAsync(data)}
      />
    </PageContainer>
  );
}

export default WorkflowCreatePage;
