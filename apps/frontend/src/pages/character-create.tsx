import { Container } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { SimplePageHeader } from "@/components/ui";
import { CharacterForm } from "@/features/characters/components/character-form";
import { showSuccessToast } from "@/lib/error-handling";
import { trpc } from "@/lib/trpc";

export function CharacterCreatePage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const createCharacterMutation = trpc.characters.create.useMutation({
    onSuccess: (character) => {
      showSuccessToast({
        title: "Character created",
        description: `New character '${character.name}' saved.`,
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
    <Container>
      <SimplePageHeader title="New Character" />
      <CharacterForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={createCharacterMutation.isPending}
        submitLabel="Create Character"
      />
    </Container>
  );
}
