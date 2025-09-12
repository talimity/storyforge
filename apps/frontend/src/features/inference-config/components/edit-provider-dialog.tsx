import type { ProviderConfig } from "@storyforge/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/index";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";
import { ProviderForm, type ProviderFormData } from "./provider-form";

interface EditProviderDialogProps {
  provider: ProviderConfig;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function EditProviderDialog({ provider, isOpen, onOpenChange }: EditProviderDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateProviderMutation = useMutation(
    trpc.providers.update.mutationOptions({
      onSuccess: () => {
        showSuccessToast({
          title: "Provider updated successfully",
          description: "Provider configuration has been updated",
        });
        queryClient.invalidateQueries(trpc.providers.list.pathFilter());
        onOpenChange(false);
      },
    })
  );

  const handleSubmit = (data: ProviderFormData) => {
    updateProviderMutation.mutate({ id: provider.id, data });
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
          <Dialog.Title>Edit Provider</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <ProviderForm
            initialData={provider}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={updateProviderMutation.isPending}
            submitLabel="Save Changes"
          />
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
