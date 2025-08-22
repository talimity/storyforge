import type {
  ProviderConfig,
  updateProviderConfigSchema,
} from "@storyforge/schemas";
import type { z } from "zod";
import { Dialog } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { showErrorToast, showSuccessToast } from "@/lib/utils/error-handling";
import { ProviderForm } from "./provider-form";

type UpdateProviderFormData = z.infer<typeof updateProviderConfigSchema>;

interface EditProviderDialogProps {
  provider: ProviderConfig;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function EditProviderDialog({
  provider,
  isOpen,
  onOpenChange,
}: EditProviderDialogProps) {
  const utils = trpc.useUtils();

  const updateProviderMutation = trpc.providers.updateProvider.useMutation({
    onSuccess: () => {
      showSuccessToast({
        title: "Provider updated successfully",
        description: "Provider configuration has been updated",
      });
      utils.providers.listProviders.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      showErrorToast({
        title: "Failed to update provider",
        error: error.message,
      });
    },
  });

  const handleSubmit = (data: UpdateProviderFormData) => {
    updateProviderMutation.mutate({
      id: provider.id,
      data,
    });
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const initialData = {
    kind: provider.kind,
    name: provider.name,
    auth: { apiKey: "" }, // Don't pre-fill the API key for security
    baseUrl: provider.baseUrl || "",
    capabilities: provider.capabilities || {
      streaming: true,
      assistantPrefill: false,
      logprobs: false,
      tools: false,
      fim: false,
    },
    hasApiKey: provider.auth.hasApiKey,
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
          <Dialog.Title>Edit Provider</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <ProviderForm
            initialData={initialData}
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
