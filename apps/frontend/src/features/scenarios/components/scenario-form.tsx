import { Card, Heading, HStack, Separator, Stack, Text } from "@chakra-ui/react";
import type { ScenarioLorebookAssignmentInput } from "@storyforge/contracts";
import { useId } from "react";
import {
  type ScenarioFormValues,
  scenarioFormDefaultValues,
  scenarioFormSchema,
} from "@/features/scenarios/components/form-schemas";
import { ParticipantManager } from "@/features/scenarios/components/participant-manager";
import { ScenarioLorebookManager } from "@/features/scenarios/components/scenario-lorebook-manager";
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
  const initialParticipants = (initialData?.participants ?? []).map((participant) => ({
    characterId: participant.characterId,
    role: participant.role,
    isUserProxy: participant.isUserProxy ?? false,
    colorOverride: participant.colorOverride,
  }));

  const fallbackParticipants = initialCharacterIds.map((characterId) => ({
    characterId,
    isUserProxy: false,
  }));

  const initialLorebooks = (initialData?.lorebooks ?? []).map((lorebook) => {
    if (lorebook.kind === "manual") {
      return {
        kind: "manual" as const,
        lorebookId: lorebook.lorebookId,
        manualAssignmentId: lorebook.manualAssignmentId,
        enabled: lorebook.enabled,
        defaultEnabled: lorebook.defaultEnabled,
        name: lorebook.name,
        entryCount: lorebook.entryCount,
      } satisfies ScenarioFormValues["lorebooks"][number];
    }

    return {
      kind: "character" as const,
      lorebookId: lorebook.lorebookId,
      characterId: lorebook.characterId,
      characterLorebookId: lorebook.characterLorebookId,
      enabled: lorebook.enabled,
      defaultEnabled: lorebook.defaultEnabled,
      overrideEnabled: lorebook.overrideEnabled,
      name: lorebook.name,
      entryCount: lorebook.entryCount,
    } satisfies ScenarioFormValues["lorebooks"][number];
  });

  const initialValues: ScenarioFormValues = {
    ...scenarioFormDefaultValues,
    name: initialData?.name ?? scenarioFormDefaultValues.name,
    description: initialData?.description ?? scenarioFormDefaultValues.description,
    participants: initialParticipants.length > 0 ? initialParticipants : fallbackParticipants,
    lorebooks: initialLorebooks,
  };

  const form = useAppForm({
    formId: `scenario-form-${useId()}`,
    defaultValues: initialValues,
    validators: { onBlur: scenarioFormSchema },
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
    <>
      <Card.Root layerStyle="surface" maxW="60rem" mx="auto">
        <form
          id={form.formId}
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

            <Stack gap={4}>
              <Heading size="md">Lorebooks</Heading>
              <Text color="content.muted" fontSize="sm">
                Assign lorebooks to this scenario to provide additional context or setting details.
                Inherited character lorebooks can also be toggled here.
              </Text>
              <ScenarioLorebookManager form={form} disabled={false} />
            </Stack>
          </Stack>

          {/* Form Actions */}
          <Card.Footer borderTopWidth={1} borderTopColor="border" pt={6}>
            <HStack justify="space-between" width="full">
              <form.AppForm>
                <form.CancelButton variant="ghost" onCancel={onCancel}>
                  Cancel
                </form.CancelButton>
                <form.SubmitButton form={form.formId} colorPalette="primary">
                  {submitLabel}
                </form.SubmitButton>
              </form.AppForm>
            </HStack>
          </Card.Footer>
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

export function serializeLorebookAssignments(
  lorebooks: ScenarioFormValues["lorebooks"]
): ScenarioLorebookAssignmentInput[] {
  const assignments: ScenarioLorebookAssignmentInput[] = [];

  for (const entry of lorebooks) {
    if (entry.kind === "manual") {
      assignments.push({
        kind: "manual",
        lorebookId: entry.lorebookId,
        enabled: entry.enabled,
      });
      continue;
    }

    const needsOverride = entry.enabled !== entry.defaultEnabled || entry.overrideEnabled !== null;
    if (!needsOverride) {
      continue;
    }

    assignments.push({
      kind: "character",
      characterLorebookId: entry.characterLorebookId,
      enabled: entry.enabled,
    });
  }

  return assignments;
}
