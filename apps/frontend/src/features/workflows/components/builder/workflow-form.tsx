import { Card, Heading, HStack, Input, Separator, Stack } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { type TaskKind, taskKindSchema } from "@storyforge/gentasks";
import { FormProvider, useForm } from "react-hook-form";
import { UnsavedChangesDialog } from "@/components/dialogs/unsaved-changes-dialog";
import { Button, Field } from "@/components/ui";
import { TaskKindSelect } from "@/components/ui/task-kind-select";
import { useUnsavedChangesProtection } from "@/hooks/use-unsaved-changes-protection";
import { type WorkflowFormValues, workflowFormSchema } from "./schemas";
import { StepsEditor } from "./steps-editor";

export interface WorkflowFormProps {
  initialData?: Partial<WorkflowFormValues>;
  submitLabel?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (data: {
    task: TaskKind;
    name: string;
    description?: string;
    steps: WorkflowFormValues["steps"];
  }) => void;
  isEditMode?: boolean;
}

export function WorkflowForm(props: WorkflowFormProps) {
  const {
    initialData,
    submitLabel = "Save",
    isSubmitting,
    onCancel,
    onSubmit,
    isEditMode = false,
  } = props;

  const methods = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowFormSchema),
    mode: "onChange",
    defaultValues: {
      task: initialData?.task ?? "turn_generation",
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      steps: initialData?.steps ?? [],
    },
  });

  const { handleSubmit, setValue, getValues, formState } = methods;

  const submit = (values: WorkflowFormValues) => onSubmit(values);

  const hasUnsavedChanges = formState.isDirty && !isSubmitting;
  const { showDialog, handleConfirmNavigation, handleCancelNavigation, confirmNavigation } =
    useUnsavedChangesProtection({
      hasUnsavedChanges,
      message: "You have unsaved changes to this workflow. Are you sure you want to leave?",
    });

  return (
    <>
      <Card.Root layerStyle="surface" maxW="900px" mx="auto">
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(submit)}>
            <Stack gap={6} p={6}>
              <Heading size="md">Workflow Details</Heading>

              <Field
                label="Task"
                required
                invalid={!!formState.errors.task}
                errorText={formState.errors.task?.message}
              >
                <TaskKindSelect
                  value={methods.getValues("task")}
                  onChange={(val) => {
                    const next = taskKindSchema.parse(val);
                    setValue("task", next, { shouldDirty: true });
                    const steps = getValues("steps");
                    if (steps?.length) {
                      setValue(
                        "steps",
                        steps.map((s) => ({ ...s, promptTemplateId: "" })),
                        { shouldDirty: true }
                      );
                    }
                  }}
                  disabled={isEditMode}
                  placeholder="Select task kind"
                />
              </Field>

              <Field
                label="Name"
                required
                invalid={!!formState.errors.name}
                errorText={formState.errors.name?.message}
              >
                <Input
                  {...methods.register("name")}
                  placeholder="Workflow name"
                  disabled={isSubmitting}
                />
              </Field>

              <Field label="Description">
                <Input
                  {...methods.register("description")}
                  placeholder="Optional description"
                  disabled={isSubmitting}
                />
              </Field>

              <Separator />

              {/* Steps Editor */}
              <StepsEditor isSubmitting={!!isSubmitting} />

              <Separator />

              {/* Form Actions */}
              <HStack justify="space-between" width="full">
                <Button variant="ghost" onClick={() => confirmNavigation(onCancel)}>
                  Cancel
                </Button>
                <Button type="submit" colorPalette="primary" disabled={isSubmitting}>
                  {submitLabel}
                </Button>
              </HStack>
            </Stack>
          </form>
        </FormProvider>
      </Card.Root>

      <UnsavedChangesDialog
        isOpen={showDialog}
        onConfirm={handleConfirmNavigation}
        onCancel={handleCancelNavigation}
        title="Unsaved Changes"
        message="You have unsaved changes to this workflow. Are you sure you want to leave?"
      />
    </>
  );
}
