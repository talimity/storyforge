import { Container, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CharacterForm } from "@/components/features/character/character-form";
import { Button, Dialog } from "@/components/ui";
import { SimplePageHeader } from "@/components/ui/page-header";
import { getApiUrl, trpc } from "@/lib/trpc";
import {
  CHARACTER_ERROR_MESSAGES,
  showErrorToast,
  showSuccessToast,
} from "@/lib/utils/error-handling";

export function CharacterEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch character data
  const {
    data: character,
    isPending: isLoadingCharacter,
    error: loadError,
  } = trpc.characters.getById.useQuery({ id: id ?? "" }, { enabled: !!id });

  // Update mutation
  const updateCharacterMutation = trpc.characters.update.useMutation({
    onSuccess: (updatedCharacter) => {
      showSuccessToast({
        title: "Character updated",
        description: `Your changes to ${updatedCharacter.name} have been saved.`,
      });

      // Invalidate the character list and detail cache to refresh the data
      utils.characters.list.invalidate();
      if (id) {
        utils.characters.getById.invalidate({ id });
      }

      // Navigate back to character library
      navigate("/characters");
    },
    onError: (error) => {
      showErrorToast({
        title: CHARACTER_ERROR_MESSAGES.UPDATE_FAILED,
        error,
        fallbackMessage:
          "Unable to update the character. Please check your input and try again.",
      });
    },
  });

  // Delete mutation
  const deleteCharacterMutation = trpc.characters.delete.useMutation({
    onSuccess: () => {
      showSuccessToast({
        title: "Character deleted",
        description: "The character has been deleted successfully.",
      });

      // Invalidate the character list cache to refresh the data
      utils.characters.list.invalidate();

      // Navigate back to character library
      navigate("/characters");
    },
    onError: (error) => {
      showErrorToast({
        title: CHARACTER_ERROR_MESSAGES.DELETE_FAILED,
        error,
        fallbackMessage: "Unable to delete the character. Please try again.",
      });
    },
  });

  // Handle form submission
  const handleSubmit = (formData: {
    name: string;
    description: string;
    cardType: "character" | "group" | "persona" | "scenario";
    imageDataUri?: string | null | undefined;
  }) => {
    if (!id) return;

    // The useImageField hook now handles image logic properly:
    // - undefined: keep existing image unchanged
    // - string (dataURI): new image was uploaded
    // - null: image was explicitly removed
    updateCharacterMutation.mutate({
      id,
      name: formData.name,
      description: formData.description,
      cardType: formData.cardType,
      imageDataUri: formData.imageDataUri,
    });
  };

  // Handle cancel
  const handleCancel = () => {
    navigate("/characters");
  };

  // Handle delete with confirmation
  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (!id) return;
    deleteCharacterMutation.mutate({ id });
    setShowDeleteDialog(false);
  };

  // Loading state
  if (isLoadingCharacter) {
    return (
      <Container>
        <Stack gap={8} align="center">
          <SimplePageHeader
            title="Edit Character"
            tagline="Loading character data..."
          />
          <Spinner size="lg" />
        </Stack>
      </Container>
    );
  }

  // Error state (character not found)
  if (loadError || !character) {
    return (
      <Container>
        <Stack gap={8} align="center">
          <SimplePageHeader
            title="Character Not Found"
            tagline="The requested character could not be found."
          />
          <Text color="fg.muted">
            {loadError?.message ||
              "The character you're looking for doesn't exist or has been deleted."}
          </Text>
          <Button onClick={() => navigate("/characters")}>
            Back to Character Library
          </Button>
        </Stack>
      </Container>
    );
  }

  // Transform character data for form (avatarPath is an API URL, not base64)
  const initialFormData = {
    name: character.name,
    description: character.description,
    cardType: character.cardType,
    // Convert relative API path to absolute URL for image preview
    imageDataUri: character.avatarPath
      ? getApiUrl(character.avatarPath)
      : undefined,
  };

  return (
    <>
      <Container>
        <SimplePageHeader
          title="Edit Character"
          actions={
            <Button
              colorPalette="red"
              variant="outline"
              onClick={handleDelete}
              disabled={
                deleteCharacterMutation.isPending ||
                updateCharacterMutation.isPending
              }
            >
              Delete Character
            </Button>
          }
        />
        <CharacterForm
          initialData={initialFormData}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={updateCharacterMutation.isPending}
          submitLabel="Update Character"
        />
      </Container>

      {/* Delete confirmation dialog */}
      <Dialog.Root
        open={showDeleteDialog}
        onOpenChange={(e) => setShowDeleteDialog(e.open)}
      >
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Delete Character</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Text>
              Are you sure you want to delete "{character.name}"? This action
              cannot be undone.
            </Text>
          </Dialog.Body>
          <Dialog.Footer>
            <HStack gap={3}>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="red"
                onClick={handleConfirmDelete}
                loading={deleteCharacterMutation.isPending}
              >
                Delete
              </Button>
            </HStack>
          </Dialog.Footer>
          <Dialog.CloseTrigger />
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}
