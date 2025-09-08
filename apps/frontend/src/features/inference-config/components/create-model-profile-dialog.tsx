import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/index";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";
import { ModelProfileForm, type ModelProfileFormData } from "./model-profile-form";

interface CreateModelProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function CreateModelProfileDialog({ isOpen, onOpenChange }: CreateModelProfileDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createModelProfileMutation = useMutation(
    trpc.providers.createModelProfile.mutationOptions({
      onSuccess: () => {
        showSuccessToast({
          title: "Model profile created successfully",
          description: "New model profile has been added",
        });
        queryClient.invalidateQueries(trpc.providers.listModelProfiles.pathFilter());
        onOpenChange(false);
      },
    })
  );

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
