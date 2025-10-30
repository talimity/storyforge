import { HStack, Stack } from "@chakra-ui/react";
import { type TaskKind, taskKindSchema } from "@storyforge/gentasks";
import { useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId } from "react";
import { Dialog } from "@/components/ui";
import { TaskKindSelect } from "@/components/ui/task-kind-select";
import { CharacterSingleSelect } from "@/features/characters/components/character-selector";
import { ScenarioSingleSelect } from "@/features/scenarios/components/scenario-selector";
import { useAppForm } from "@/lib/app-form";
import { showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";
import {
  type AssignmentFormValues,
  assignmentFormDefaultValues,
  assignmentFormSchema,
} from "./assignment-form-schemas";

const scopeOptions: Array<{
  value: "default" | "scenario" | "character" | "participant";
  label: string;
}> = [
  { value: "default", label: "Default" },
  { value: "scenario", label: "Scenario" },
  { value: "character", label: "Character" },
  { value: "participant", label: "Participant" },
];

interface AssignmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTask?: TaskKind;
  /** Enables restricted editing: only workflow can change; scope + target are read-only */
  isEditMode?: boolean;
  /** Initial values when editing an existing assignment */
  initialAssignment?: AssignmentFormValues;
}

export function AssignmentDialog({
  isOpen,
  onOpenChange,
  defaultTask = "turn_generation",
  isEditMode = false,
  initialAssignment,
}: AssignmentDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const upsert = useMutation(
    trpc.workflows.upsertScope.mutationOptions({
      onSuccess: async () => {
        showSuccessToast({ title: "Assignment saved" });
        await queryClient.invalidateQueries(trpc.workflows.listScopes.pathFilter());
        onOpenChange(false);
      },
    })
  );

  const initialValues = initialAssignment
    ? { ...assignmentFormDefaultValues, ...initialAssignment }
    : { ...assignmentFormDefaultValues, task: defaultTask, scopeKind: "default" as const };

  const form = useAppForm({
    formId: `assignment-dialog-form-${useId()}`,
    defaultValues: initialValues,
    validators: { onSubmit: assignmentFormSchema },
    onSubmit: async ({ value }) => {
      await upsert.mutateAsync(value);
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    if (isOpen) {
      form.reset(initialValues);
      upsert.reset();
    }
  }, [isOpen]);

  const selectedTask = useStore(form.store, (state) => state.values.task);
  const selectedScope = useStore(form.store, (state) => state.values.scopeKind);

  const workflowsQuery = useQuery(
    trpc.workflows.list.queryOptions({ task: selectedTask ?? defaultTask })
  );

  const workflowOptions = (workflowsQuery.data?.workflows ?? []).map((wf) => ({
    value: wf.id,
    label: wf.name,
  }));

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={({ open }) => onOpenChange(open)}
      placement="center"
      size="lg"
      closeOnEscape={false}
      closeOnInteractOutside={false}
    >
      <Dialog.Content>
        <form
          id={form.formId}
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <Dialog.Header>
            <Dialog.Title>{isEditMode ? "Edit Assignment" : "New Assignment"}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap={4}>
              <form.AppField name="task">
                {(field) => (
                  <field.Field label="Task" required>
                    <TaskKindSelect
                      value={field.state.value}
                      onChange={(value) => {
                        if (!value) return;
                        field.handleChange(taskKindSchema.parse(value));
                      }}
                      disabled={isEditMode}
                      inDialog
                    />
                  </field.Field>
                )}
              </form.AppField>

              <form.AppField name="workflowId">
                {(field) => (
                  <field.Select
                    label="Workflow"
                    required
                    options={workflowOptions}
                    placeholder={workflowsQuery.isLoading ? "Loading..." : "Select workflow"}
                    disabled={workflowsQuery.isLoading}
                    helperText={
                      !workflowsQuery.isLoading && workflowOptions.length === 0
                        ? "No workflows available for this task"
                        : undefined
                    }
                  />
                )}
              </form.AppField>

              <HStack gap={3} align="start">
                <form.AppField
                  name="scopeKind"
                  listeners={{
                    onChange: ({ value }) => {
                      if (value !== "scenario") {
                        form.setFieldValue("scenarioId", undefined);
                      }
                      if (value !== "character") {
                        form.setFieldValue("characterId", undefined);
                      }
                      if (value !== "participant") {
                        form.setFieldValue("participantId", undefined);
                      }
                    },
                  }}
                >
                  {(field) => (
                    <field.Select
                      label="Scope"
                      required
                      options={scopeOptions}
                      disabled={isEditMode}
                    />
                  )}
                </form.AppField>

                {selectedScope === "scenario" && (
                  <form.AppField name="scenarioId">
                    {(field) => (
                      <field.Field label="Scenario" required>
                        <ScenarioSingleSelect
                          inDialog
                          value={field.state.value}
                          onChange={(id) => field.handleChange(id)}
                          disabled={isEditMode}
                        />
                      </field.Field>
                    )}
                  </form.AppField>
                )}

                {selectedScope === "character" && (
                  <form.AppField name="characterId">
                    {(field) => (
                      <field.Field label="Character" required>
                        <CharacterSingleSelect
                          inDialog
                          value={field.state.value ?? null}
                          onChange={(id) => field.handleChange(id ?? undefined)}
                          disabled={isEditMode}
                        />
                      </field.Field>
                    )}
                  </form.AppField>
                )}

                {selectedScope === "participant" && (
                  <form.AppField name="participantId">
                    {(field) => (
                      <field.TextInput
                        label="Participant ID"
                        required
                        placeholder="participant id"
                        disabled={isEditMode}
                      />
                    )}
                  </form.AppField>
                )}
              </HStack>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <form.AppForm>
              <Dialog.ActionTrigger asChild>
                <form.CancelButton variant="outline" onCancel={() => onOpenChange(false)}>
                  Cancel
                </form.CancelButton>
              </Dialog.ActionTrigger>
              <form.SubmitButton form={form.formId} colorPalette="primary">
                {isEditMode ? "Save Changes" : "Save Assignment"}
              </form.SubmitButton>
            </form.AppForm>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
