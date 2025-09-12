import { Card, HStack, Stack, Tabs } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { TaskKind } from "@storyforge/gentasks";
import { FormProvider, useForm } from "react-hook-form";
import { LuEye, LuInfo, LuListOrdered } from "react-icons/lu";
import { UnsavedChangesDialog } from "@/components/dialogs/unsaved-changes-dialog";
import { Button } from "@/components/ui";
import { useUnsavedChangesProtection } from "@/hooks/use-unsaved-changes-protection";
import { type WorkflowFormValues, workflowFormSchema } from "./schemas";
import { StepsEditor } from "./steps-editor";
import { WorkflowDetailsTab } from "./workflow-details";
import { WorkflowPreviewTab } from "./workflow-preview";

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

  const { handleSubmit, getValues, formState } = methods;

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
            <Tabs.Root defaultValue="metadata">
              <Tabs.List>
                <Tabs.Trigger value="metadata">
                  <LuInfo />
                  Metadata
                </Tabs.Trigger>
                <Tabs.Trigger value="steps">
                  <LuListOrdered />
                  Steps
                </Tabs.Trigger>
                <Tabs.Trigger value="preview">
                  <LuEye />
                  Preview
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="metadata" p={6}>
                <WorkflowDetailsTab isEditMode={isEditMode} isSubmitting={!!isSubmitting} />
              </Tabs.Content>

              <Tabs.Content value="steps" p={6}>
                <StepsEditor isSubmitting={!!isSubmitting} />
              </Tabs.Content>

              <Tabs.Content value="preview" p={6}>
                <WorkflowPreviewTab values={getValues()} />
              </Tabs.Content>
            </Tabs.Root>

            <Stack p={6} pt={0}>
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
