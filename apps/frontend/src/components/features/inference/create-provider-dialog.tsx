import type { createProviderConfigSchema } from "@storyforge/schemas";
import type { z } from "zod";
import { Dialog } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { showSuccessToast } from "@/lib/utils/error-handling";
import { ProviderForm } from "./provider-form";

type CreateProviderFormData = z.infer<typeof createProviderConfigSchema>;

interface CreateProviderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function CreateProviderDialog({
  isOpen,
  onOpenChange,
}: CreateProviderDialogProps) {
  const utils = trpc.useUtils();

  const createProviderMutation = trpc.providers.createProvider.useMutation({
    onSuccess: () => {
      showSuccessToast({
        title: "Provider created successfully",
        description: "New provider configuration has been added",
      });
      utils.providers.listProviders.invalidate();
      onOpenChange(false);
    },
  });

  const handleSubmit = (data: CreateProviderFormData) => {
    createProviderMutation.mutate(data);
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
