import { Container, Stack } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { CharacterForm } from "@/components/features/character/character-form";
import { SimplePageHeader } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import {
  CHARACTER_ERROR_MESSAGES,
  showErrorToast,
  showSuccessToast,
} from "@/lib/utils/error-handling";

export function CharacterCreatePage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const createCharacterMutation = trpc.characters.create.useMutation({
    onSuccess: (character) => {
      showSuccessToast({
        title: "Character created",
        description: `${character.name} has been created successfully.`,
      });

      // Invalidate the character list cache to refresh the data
      utils.characters.list.invalidate();

      // Navigate back to character library
      navigate("/characters");
    },
    onError: (error) => {
      showErrorToast({
        title: CHARACTER_ERROR_MESSAGES.CREATE_FAILED,
        error,
        fallbackMessage:
          "Unable to create the character. Please check your input and try again.",
      });
    },
  });

  const handleSubmit = (formData: {
    name: string;
    description: string;
    cardType: "character" | "group" | "persona" | "scenario";
    imageDataUri?: string | null | undefined;
  }) => {
    createCharacterMutation.mutate({
      name: formData.name,
      description: formData.description,
      cardType: formData.cardType,
      imageDataUri: formData.imageDataUri ?? undefined,
    });
  };

  const handleCancel = () => {
    navigate("/characters");
  };

  return (
    <Container maxW="5xl" py={6}>
      <Stack gap={8}>
        <SimplePageHeader
          title="Create Character"
          tagline="Create a new character for your StoryForge scenarios"
        />

        <CharacterForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createCharacterMutation.isPending}
          submitLabel="Create Character"
        />
      </Stack>
    </Container>
  );
}
