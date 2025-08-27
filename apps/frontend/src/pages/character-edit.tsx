import { Container, Spinner, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CharacterDeleteDialog } from "@/components/dialogs/character-delete";
import { CharacterForm } from "@/components/features/character/character-form";
import { Button } from "@/components/ui";
import { SimplePageHeader } from "@/components/ui/page-header";
import { getApiUrl, trpc } from "@/lib/trpc";
import { showSuccessToast } from "@/lib/utils/error-handling";

export function CharacterEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    data: character,
    isPending: isLoadingCharacter,
    error: loadError,
  } = trpc.characters.getById.useQuery({ id: id ?? "" }, { enabled: !!id });

  const updateCharacterMutation = trpc.characters.update.useMutation({
    onSuccess: (updatedCharacter) => {
      showSuccessToast({
        title: "Character updated",
        description: `Changes to character '${updatedCharacter.name}' saved.`,
      });

      utils.characters.list.invalidate();
      if (id) {
        utils.characters.getById.invalidate({ id });
      }

      navigate("/characters");
    },
  });

  const deleteCharacterMutation = trpc.characters.delete.useMutation({
    onSuccess: () => {
      showSuccessToast({
        title: "Character deleted",
        description: `Character '${character?.name}' deleted from your library.`,
      });

      utils.characters.list.invalidate();

      navigate("/characters");
    },
  });

  const handleSubmit = (formData: {
    name: string;
    description: string;
    cardType: "character" | "group" | "persona" | "scenario";
    imageDataUri?: string | null | undefined;
  }) => {
    if (!id) return;

    updateCharacterMutation.mutate({
      id,
      name: formData.name,
      description: formData.description,
      cardType: formData.cardType,
      imageDataUri: formData.imageDataUri,
    });
  };

  const handleCancel = () => {
    navigate("/characters");
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (!id) return;
    deleteCharacterMutation.mutate({ id });
    setShowDeleteDialog(false);
  };

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

  const initialFormData = {
    name: character.name,
    description: character.description,
    cardType: character.cardType,
    imageDataUri: character.avatarPath
      ? getApiUrl(character.avatarPath) || undefined
      : undefined,
  };

  return (
    <>
      <Container>
        <SimplePageHeader
          title={character.name}
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

      <CharacterDeleteDialog
        isOpen={showDeleteDialog}
        onOpenChange={(details) => setShowDeleteDialog(details.open)}
        characterName={character.name}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={deleteCharacterMutation.isPending}
      />
    </>
  );
}
