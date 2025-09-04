import { Dialog } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { showSuccessToast } from "@/lib/utils/error-handling";
import {
  ModelProfileForm,
  type ModelProfileFormData,
} from "./model-profile-form";

interface CreateModelProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function CreateModelProfileDialog({
  isOpen,
  onOpenChange,
}: CreateModelProfileDialogProps) {
  const utils = trpc.useUtils();

  const createModelProfileMutation =
    trpc.providers.createModelProfile.useMutation({
      onSuccess: () => {
        showSuccessToast({
          title: "Model profile created successfully",
          description: "New model profile has been added",
        });
        utils.providers.listModelProfiles.invalidate();
        onOpenChange(false);
      },
    });

  const handleSubmit = (data: ModelProfileFormData) => {
    createModelProfileMutation.mutate(data);
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
          <Dialog.Title>Add Model Profile</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <ModelProfileForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={createModelProfileMutation.isPending}
            submitLabel="Create Model Profile"
          />
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
