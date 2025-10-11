import { Container, Heading, Separator, Spinner, Stack, Text } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui";
import { SimplePageHeader } from "@/components/ui/page-header";
import { CharacterDeleteDialog } from "@/features/characters/components/character-delete-dialog";
import {
  CharacterForm,
  type CharacterFormData,
} from "@/features/characters/components/character-form";
import { CharacterLorebookManager } from "@/features/characters/components/character-lorebook-manager";
import { showSuccessToast } from "@/lib/error-handling";
import { getApiUrl } from "@/lib/get-api-url";
import { useTRPC } from "@/lib/trpc";

function CharacterEditPage() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    data: character,
    isPending: isLoadingCharacter,
    error: loadError,
  } = useQuery(trpc.characters.getById.queryOptions({ id: id ?? "" }, { enabled: !!id }));

  const updateCharacterMutation = useMutation(
    trpc.characters.update.mutationOptions({
      onSuccess: (updatedCharacter) => {
        showSuccessToast({
          title: "Character updated",
          description: `Changes to character '${updatedCharacter.name}' saved.`,
        });

        queryClient.invalidateQueries(trpc.characters.list.pathFilter());
        if (id) {
          queryClient.invalidateQueries(trpc.characters.getById.queryFilter({ id }));
        }

        navigate("/characters");
      },
    })
  );

  const deleteCharacterMutation = useMutation(
    trpc.characters.delete.mutationOptions({
      onSuccess: () => {
        showSuccessToast({
          title: "Character deleted",
          description: `Character '${character?.name}' deleted from your library.`,
        });

        queryClient.invalidateQueries(trpc.characters.list.pathFilter());

        navigate("/characters");
      },
    })
  );

  if (isLoadingCharacter) {
    return (
      <Container>
        <Stack gap={8} align="center">
          <SimplePageHeader title="Edit Character" tagline="Loading character data..." />
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
          <Button onClick={() => navigate("/characters")}>Back to Character Library</Button>
        </Stack>
      </Container>
    );
  }

  const initialFormData = {
    name: character.name,
    description: character.description,
    cardType: character.cardType,
    styleInstructions: character.styleInstructions || "",
    imageDataUri: character.avatarPath ? getApiUrl(character.avatarPath) || undefined : undefined,
    portraitFocalPoint: character.portraitFocalPoint,
    starters: character.starters.map((s) => ({
      id: s.id,
      message: s.message,
      isPrimary: s.isPrimary,
    })),
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
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteCharacterMutation.isPending || updateCharacterMutation.isPending}
            >
              Delete Character
            </Button>
          }
        />
        <CharacterForm
          initialData={initialFormData}
          onSubmit={(formData: CharacterFormData) =>
            updateCharacterMutation.mutateAsync({ id: String(id), ...formData })
          }
          onCancel={() => navigate("/characters")}
          submitLabel="Update Character"
          portraitSrc={
            character.imagePath
              ? (getApiUrl(character.imagePath) ?? character.imagePath)
              : undefined
          }
          characterId={id}
        />
        <Separator my={6} />
        <Stack gap={4}>
          <Heading size="md">Linked Lorebooks</Heading>
          <CharacterLorebookManager characterId={id ?? ""} />
        </Stack>
      </Container>

      <CharacterDeleteDialog
        isOpen={showDeleteDialog}
        onOpenChange={(details) => setShowDeleteDialog(details.open)}
        characterName={character.name}
        onConfirmDelete={() => {
          if (!id) return;
          deleteCharacterMutation.mutate({ id });
          setShowDeleteDialog(false);
        }}
        isDeleting={deleteCharacterMutation.isPending}
      />
    </>
  );
}

export default CharacterEditPage;
