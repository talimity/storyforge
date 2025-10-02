import { Card, HStack, Stack, Tabs } from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/gentasks";
import { LuEye, LuInfo, LuListOrdered } from "react-icons/lu";
import { useAppForm } from "@/lib/app-form";
import {
  type WorkflowFormValues,
  workflowFormDefaultValues,
  workflowFormSchema,
} from "./form-schemas";
import { StepsEditor } from "./steps-editor";
import { WorkflowDetailsTab } from "./workflow-details";
import { WorkflowPreviewTab } from "./workflow-preview";

export interface WorkflowFormProps {
  initialData?: Partial<WorkflowFormValues>;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (data: {
    task: TaskKind;
    name: string;
    description?: string;
    steps: WorkflowFormValues["steps"];
  }) => Promise<unknown>;
  isEditMode?: boolean;
}

export function WorkflowForm(props: WorkflowFormProps) {
  const { initialData, submitLabel = "Save", onCancel, onSubmit, isEditMode = false } = props;

  const form = useAppForm({
    defaultValues: { ...workflowFormDefaultValues, ...initialData },
    validators: { onChange: workflowFormSchema },
    onSubmit: ({ value }) => onSubmit(value),
    onSubmitInvalid: ({ formApi }) => {
      // focusFirstInvalidField(formApi); //TODO: fix
    },
  });

  return (
    <>
      <Card.Root layerStyle="surface" maxW="900px" mx="auto">
        <form
          id="workflow-form"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <Tabs.Root defaultValue="metadata" lazyMount>
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
              <WorkflowDetailsTab form={form} isEditMode={isEditMode} />
            </Tabs.Content>

            <Tabs.Content value="steps" p={6}>
              <StepsEditor form={form} />
            </Tabs.Content>

            <Tabs.Content value="preview" p={6}>
              <form.Subscribe
                selector={(state) => ({
                  task: state.values.task,
                  name: state.values.name,
                  description: state.values.description,
                  steps: state.values.steps,
                })}
              >
                {(values) => <WorkflowPreviewTab values={values} />}
              </form.Subscribe>
            </Tabs.Content>
          </Tabs.Root>

          <Stack p={6} pt={0}>
            <HStack justify="space-between" width="full">
              <form.AppForm>
                <form.CancelButton variant="ghost" onCancel={onCancel}>
                  Cancel
                </form.CancelButton>
                <form.SubmitButton form="workflow-form" colorPalette="primary">
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
          message="You have unsaved changes to this workflow. Are you sure you want to leave?"
        />
      </form.AppForm>
    </>
  );
}

// type WorkflowFormApi = ReturnType<typeof useAppForm>;
// function focusFirstInvalidField(formApi: WorkflowFormApi) {
//   const root = document.getElementById("workflow-form");
//   if (!root) return;
//
//   const interactive = Array.from(
//     root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[name]")
//   );
//
//   for (const element of interactive) {
//     const name = element.getAttribute("name");
//     if (!name) continue;
//     const meta = formApi.getFieldMeta(name as never);
//     if (meta?.errors && meta.errors.length > 0) {
//       element.focus();
//       return;
//     }
//   }
// }
