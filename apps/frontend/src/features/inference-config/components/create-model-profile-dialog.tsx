import { Skeleton } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Dialog } from "@/components/ui";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";
import type { ModelProfileFormData } from "./model-profile-form";

interface CreateModelProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const ModelProfileForm = lazy(() => import("./model-profile-form"));

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

  const handleSubmit = (data: ModelProfileFormData) => createModelProfileMutation.mutateAsync(data);

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
          <Dialog.Title>Add Model Profile</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Suspense fallback={<Skeleton minH="lg" minW="lg" />}>
            <ModelProfileForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              submitLabel="Create Model Profile"
            />
          </Suspense>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
