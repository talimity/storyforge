import {
  Card,
  Grid,
  Heading,
  HStack,
  Input,
  Separator,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { UnsavedChangesDialog } from "@/components/dialogs/unsaved-changes";
import { CharacterCard } from "@/components/features/character/character-card";
import { Button, Field } from "@/components/ui";
import { useUnsavedChangesProtection } from "@/lib/hooks/use-unsaved-changes-protection";
import { trpc } from "@/lib/trpc";

const scenarioFormSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000),
  characterIds: z
    .array(z.string())
    .min(2, "A scenario requires at least 2 characters"),
});

type ScenarioFormData = z.infer<typeof scenarioFormSchema>;

interface ScenarioFormProps {
  initialData?: Partial<ScenarioFormData>;
  initialCharacterIds?: string[];
  onSubmit: (data: ScenarioFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function ScenarioForm({
  initialData,
  initialCharacterIds = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Save Scenario",
}: ScenarioFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
  } = useForm<ScenarioFormData>({
    resolver: zodResolver(scenarioFormSchema),
    mode: "onBlur",
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      characterIds: initialData?.characterIds || initialCharacterIds,
    },
  });

  const characterIds = watch("characterIds");

  const charactersQuery = trpc.characters.getByIds.useQuery(
    { ids: characterIds },
    { enabled: characterIds.length > 0 }
  );

  const selectedCharacters = charactersQuery.data?.characters || [];

  const onFormSubmit = (data: ScenarioFormData) => {
    onSubmit(data);
  };

  const hasUnsavedChanges = isDirty && !isSubmitting;

  const {
    showDialog,
    handleConfirmNavigation,
    handleCancelNavigation,
    confirmNavigation,
  } = useUnsavedChangesProtection({
    hasUnsavedChanges,
    message:
      "You have unsaved changes to this scenario. Are you sure you want to leave?",
  });

  const canSubmit = characterIds.length >= 2;

  return (
    <>
      <Card.Root layerStyle="surface" maxW="900px" mx="auto">
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <Stack gap={6} p={6}>
            {/* Basic Information Section */}
            <Stack gap={4}>
              <Heading size="md" textStyle="heading">
                Scenario Details
              </Heading>

              <Field
                label="Scenario Name"
                required
                errorText={
                  errors.name?.message || "Please enter a name for the scenario"
                }
                invalid={!!errors.name}
              >
                <Input
                  {...register("name")}
                  placeholder="Enter scenario name..."
                  disabled={isSubmitting}
                  autoComplete="off"
                />
              </Field>

              <Field
                label="Description"
                helperText="Brief description of the scenario setup or premise"
                errorText={errors.description?.message}
                invalid={!!errors.description}
              >
                <Textarea
                  {...register("description")}
                  placeholder="Enter scenario description..."
                  disabled={isSubmitting}
                  resize="vertical"
                  minH={20}
                  autoComplete="off"
                />
              </Field>
            </Stack>

            <Separator />

            {/* Characters Section */}
            <Stack gap={4}>
              <Heading size="md" textStyle="heading">
                {`Characters (${selectedCharacters.length})`}
              </Heading>

              {selectedCharacters.length === 0 ? (
                <Text color="content.muted">
                  No characters selected. A scenario requires at least 2
                  characters.
                </Text>
              ) : (
                <Grid
                  templateColumns="repeat(auto-fit, 240px)"
                  justifyContent="center"
                  gap={4}
                >
                  {selectedCharacters.map((character) => (
                    <CharacterCard
                      key={character.id}
                      character={character}
                      readOnly
                    />
                  ))}
                </Grid>
              )}
            </Stack>

            {/* Form Actions */}
            <HStack justify="end" pt={4}>
              <Button
                variant="outline"
                colorPalette="neutral"
                onClick={() => confirmNavigation(onCancel)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="solid"
                colorPalette="primary"
                loading={isSubmitting}
                disabled={!canSubmit}
              >
                {submitLabel}
              </Button>
            </HStack>
          </Stack>
        </form>
      </Card.Root>

      <UnsavedChangesDialog
        isOpen={showDialog}
        onCancel={handleCancelNavigation}
        onConfirm={handleConfirmNavigation}
        title="Unsaved Changes"
        message="You have unsaved changes to this scenario. Are you sure you want to leave?"
      />
    </>
  );
}
