import { Container } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { SimplePageHeader } from "@/components/ui";
import { LorebookForm } from "@/features/lorebooks/components/lorebook-form";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

export function LorebookCreatePage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createMutation = useMutation(
    trpc.lorebooks.create.mutationOptions({
      onSuccess: async (result) => {
        showSuccessToast({ title: `Created lorebook "${result.name}"` });
        await queryClient.invalidateQueries(trpc.lorebooks.pathFilter());
        navigate("/lorebooks");
      },
      onError: (error) => showErrorToast({ title: "Failed to create lorebook", error }),
    })
  );

  return (
    <Container>
      <SimplePageHeader title="Create Lorebook" />
      <LorebookForm
        submitLabel="Create Lorebook"
        onCancel={() => navigate("/lorebooks")}
        onSubmit={(data) => createMutation.mutateAsync({ data })}
      />
    </Container>
  );
}
