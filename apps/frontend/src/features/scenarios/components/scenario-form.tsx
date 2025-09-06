import {
  Card,
  Heading,
  HStack,
  Input,
  Separator,
  Stack,
  Textarea,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { UnsavedChangesDialog } from "@/components/dialogs/unsaved-changes-dialog";
import { Button, Field } from "@/components/ui/index";
import { ParticipantManager } from "@/features/scenarios/components/participant-manager";
import { useUnsavedChangesProtection } from "@/hooks/use-unsaved-changes-protection";
import { trpc } from "@/lib/trpc";

const scenarioFormSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000),
  participants: z
    .array(
      z.object({
        characterId: z.string(),
        role: z.string().optional(),
        isUserProxy: z.boolean().optional(),
      })
    )
    .min(2, "A scenario requires at least 2 characters"),
});

type ScenarioFormData = z.infer<typeof scenarioFormSchema>;

interface ScenarioFormProps {
  initialData?: Partial<ScenarioFormData>;
  initialCharacterIds?: string[];
  scenarioId?: string;
  onSubmit: (data: ScenarioFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function ScenarioForm({
  initialData,
  initialCharacterIds = [],
  scenarioId,
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
    setValue,
  } = useForm<ScenarioFormData>({
    resolver: zodResolver(scenarioFormSchema),
    mode: "onBlur",
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      participants:
        initialData?.participants ||
        initialCharacterIds.map((id) => ({
          characterId: id,
          role: undefined,
          isUserProxy: false,
        })),
    },
  });

  const participants = watch("participants");

  const charactersQuery = trpc.characters.getByIds.useQuery(
    { ids: participants.map((p) => p.characterId) },
    { enabled: participants.length > 0 }
  );

  const participantsWithDetails = participants.map((p) => ({
    ...p,
    character: charactersQuery.data?.characters.find(
      (c) => c.id === p.characterId
    ) || {
      id: p.characterId,
      name: "Loading...",
      avatarPath: null,
    },
  }));

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

  const canSubmit = participants.length >= 2;

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

            {/* Participants Section */}
            <Stack gap={4}>
              <Heading size="md" textStyle="heading">
                Participants
              </Heading>

              <ParticipantManager
                participants={participantsWithDetails}
                onChange={(newParticipants) =>
                  setValue("participants", newParticipants, {
                    shouldDirty: true,
                  })
                }
                scenarioId={scenarioId}
                isDisabled={isSubmitting}
              />
            </Stack>

            <Separator />

            {/* Form Actions */}
            <HStack justify="space-between" width="full">
              <Button
                variant="ghost"
                onClick={() => confirmNavigation(onCancel)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="solid"
                colorPalette="primary"
                disabled={!canSubmit}
                loading={isSubmitting}
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
