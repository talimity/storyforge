import type {
  ModelProfile,
  updateModelProfileSchema,
} from "@storyforge/schemas";
import type { z } from "zod";
import { Dialog } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { showErrorToast, showSuccessToast } from "@/lib/utils/error-handling";
import { ModelProfileForm } from "./model-profile-form";

type UpdateModelProfileFormData = z.infer<typeof updateModelProfileSchema>;

interface EditModelProfileDialogProps {
  modelProfile: ModelProfile;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function EditModelProfileDialog({
  modelProfile,
  isOpen,
  onOpenChange,
}: EditModelProfileDialogProps) {
  const utils = trpc.useUtils();

  const updateModelProfileMutation =
    trpc.providers.updateModelProfile.useMutation({
      onSuccess: () => {
        showSuccessToast({
          title: "Model profile updated successfully",
          description: "Model profile has been updated",
        });
        utils.providers.listModelProfiles.invalidate();
        onOpenChange(false);
      },
      onError: (error) => {
        showErrorToast({
          title: "Failed to update model profile",
          error: error.message,
        });
      },
    });

  const handleSubmit = (data: UpdateModelProfileFormData) => {
    updateModelProfileMutation.mutate({
      id: modelProfile.id,
      data,
    });
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const initialData = {
    providerId: modelProfile.providerId,
    displayName: modelProfile.displayName,
    modelId: modelProfile.modelId,
    capabilityOverrides: modelProfile.capabilityOverrides || {
      streaming: false,
      assistantPrefill: false,
      logprobs: false,
      tools: false,
      fim: false,
    },
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
          <Dialog.Title>Edit Model Profile</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <ModelProfileForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={updateModelProfileMutation.isPending}
            submitLabel="Save Changes"
          />
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
