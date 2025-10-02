import { Card, Heading, HStack, Separator, Stack } from "@chakra-ui/react";
import {
  type ScenarioFormValues,
  scenarioFormDefaultValues,
  scenarioFormSchema,
} from "@/features/scenarios/components/form-schemas";
import { ParticipantManager } from "@/features/scenarios/components/participant-manager";
import { useAppForm } from "@/lib/app-form";

interface ScenarioFormProps {
  initialData?: Partial<ScenarioFormValues>;
  initialCharacterIds?: string[];
  scenarioId?: string;
  onSubmit: (data: ScenarioFormValues) => Promise<unknown>;
  onCancel: () => void;
  submitLabel?: string;
}

export function ScenarioForm({
  initialData,
  initialCharacterIds = [],
  scenarioId,
  onSubmit,
  onCancel,
  submitLabel = "Save Scenario",
}: ScenarioFormProps) {
  const initialParticipants = initialData?.participants
    ? initialData.participants
    : initialCharacterIds.map((characterId) => ({
        characterId,
        role: undefined,
        isUserProxy: false,
      }));

  const initialValues: ScenarioFormValues = {
    ...scenarioFormDefaultValues,
    ...initialData,
    participants: initialParticipants,
  };

  const form = useAppForm({
    defaultValues: initialValues,
    validators: { onBlur: scenarioFormSchema },
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
    <>
      <Card.Root layerStyle="surface" maxW="900px" mx="auto">
        <form
          id="scenario-form"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <Stack gap={6} p={6}>
            {/* Basic Information Section */}
            <Stack gap={4}>
              <Heading size="md">Scenario Details</Heading>

              <form.AppField name="name">
                {(f) => (
                  <f.TextInput
                    label="Scenario Name"
                    placeholder="Enter scenario name..."
                    required
                  />
                )}
              </form.AppField>

              <form.AppField name="description">
                {(f) => (
                  <f.TextareaInput
                    label="Description"
                    placeholder="Enter scenario description..."
                    autosize
                    minRows={2}
                  />
                )}
              </form.AppField>
            </Stack>

            <Separator />

            {/* Participants Section */}
            <Stack gap={4}>
              <Heading size="md">Participants</Heading>
              <ParticipantManager
                form={form}
                fields={{ items: "participants" }}
                scenarioId={scenarioId}
              />
            </Stack>

            <Separator />

            {/* Form Actions */}
            <HStack justify="space-between" width="full">
              <form.AppForm>
                <form.CancelButton variant="ghost" onCancel={onCancel}>
                  Cancel
                </form.CancelButton>
                <form.SubmitButton form="scenario-form" colorPalette="primary">
                  {submitLabel}
                </form.SubmitButton>
              </form.AppForm>
            </HStack>
          </Stack>
        </form>
      </Card.Root>

      <form.AppForm>
        <form.SubscribedUnsavedChangesDialog
          title="Unsaved Changes"
          message="You have unsaved changes to this scenario. Are you sure you want to leave?"
        />
      </form.AppForm>
    </>
  );
}
