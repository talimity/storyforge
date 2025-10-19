import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { SimplePageHeader } from "@/components/ui";
import { PageContainer } from "@/components/ui/page-container";
import {
  CharacterForm,
  type CharacterFormData,
} from "@/features/characters/components/form/character-form";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

function CharacterCreatePage() {
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

  const handleSubmit = (formData: CharacterFormData) =>
    createCharacterMutation.mutateAsync({
      name: formData.name,
      description: formData.description,
      cardType: formData.cardType,
      starters: formData.starters,
      styleInstructions: formData.styleInstructions ?? undefined,
      imageDataUri: formData.imageDataUri ?? undefined,
    });

  const handleCancel = () => {
    navigate("/characters");
  };

  return (
    <PageContainer>
      <SimplePageHeader title="New Character" />
      <CharacterForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        submitLabel="Create Character"
      />
    </PageContainer>
  );
}

export default CharacterCreatePage;
