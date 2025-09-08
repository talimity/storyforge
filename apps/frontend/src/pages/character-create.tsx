import { Container } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { SimplePageHeader } from "@/components/ui";
import { CharacterForm } from "@/features/characters/components/character-form";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

export function CharacterCreatePage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createCharacterMutation = useMutation(
    trpc.characters.create.mutationOptions({
      onSuccess: (character) => {
        showSuccessToast({
          title: "Character created",
          description: `New character '${character.name}' saved.`,
        });

        queryClient.invalidateQueries(trpc.characters.list.pathFilter());

        navigate("/characters");
      },
    })
  );

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
