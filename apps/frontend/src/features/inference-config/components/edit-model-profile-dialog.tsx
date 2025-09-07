import type { ModelProfile } from "@storyforge/contracts";
import { Dialog } from "@/components/ui/index";
import { showSuccessToast } from "@/lib/error-handling";
import { trpc } from "@/lib/trpc";
import { ModelProfileForm, type ModelProfileFormData } from "./model-profile-form";

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

  const updateModelProfileMutation = trpc.providers.updateModelProfile.useMutation({
    onSuccess: () => {
      showSuccessToast({
        title: "Model profile updated successfully",
        description: "Model profile has been updated",
      });
      utils.providers.listModelProfiles.invalidate();
      onOpenChange(false);
    },
  });

  const handleSubmit = (data: ModelProfileFormData) => {
    updateModelProfileMutation.mutate({ id: modelProfile.id, data });
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
          <Dialog.Title>Edit Model Profile</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <ModelProfileForm
            initialData={modelProfile}
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
