import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/index";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";
import { ProviderForm, type ProviderFormData } from "./provider-form";

interface CreateProviderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function CreateProviderDialog({ isOpen, onOpenChange }: CreateProviderDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createProviderMutation = useMutation(
    trpc.providers.create.mutationOptions({
      onSuccess: () => {
        showSuccessToast({
          title: "Provider created successfully",
          description: "New provider configuration has been added",
        });
        queryClient.invalidateQueries(trpc.providers.list.pathFilter());
        onOpenChange(false);
      },
    })
  );

  const handleSubmit = (data: ProviderFormData) => {
    // Undefined is not allowed in create operations
    const createData = {
      ...data,
      auth: { ...data.auth, apiKey: data.auth.apiKey ?? null },
    };
    createProviderMutation.mutate(createData);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={({ open }) => !open && handleCancel()}
      placement="center"
      size="lg"
      closeOnEscape={false}
      closeOnInteractOutside={false}
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Add Provider</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <ProviderForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={createProviderMutation.isPending}
            submitLabel="Create Provider"
          />
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
