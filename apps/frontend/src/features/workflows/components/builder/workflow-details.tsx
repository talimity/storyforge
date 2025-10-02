import { Heading, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { LuFileText } from "react-icons/lu";
import { TaskKindSelect } from "@/components/ui/task-kind-select";
import { workflowFormDefaultValues } from "@/features/workflows/components/builder/form-schemas";
import { withForm } from "@/lib/app-form";

export const WorkflowDetailsTab = withForm({
  defaultValues: workflowFormDefaultValues,
  props: { isEditMode: false },
  render: function Render({ form, isEditMode }) {
    return (
      <Stack gap={6}>
        <HStack gap={3}>
          <LuFileText size={20} />
          <VStack align="start" gap={0}>
            <Heading size="md">Workflow Metadata</Heading>
            <Text color="content.muted" fontSize="sm">
              Set basic configuration
            </Text>
          </VStack>
        </HStack>

        <form.AppField
          name="task"
          listeners={{
            onChange: () => {
              const steps = form.getFieldValue("steps");
              if (!Array.isArray(steps) || steps.length === 0) {
                return;
              }

              form.setFieldValue(
                "steps",
                steps.map((step) => ({ ...step, promptTemplateId: "" }))
              );
            },
          }}
        >
          {(field) => {
            const selectedTask = field.state.value;
            return (
              <field.Field label="Task" required>
                <TaskKindSelect
                  value={selectedTask ?? ""}
                  onChange={(next) => {
                    if (!next) return;
                    field.handleChange(() => next);
                  }}
                  disabled={isEditMode}
                  placeholder="Select task kind"
                />
              </field.Field>
            );
          }}
        </form.AppField>

        <form.AppField name="name">
          {(field) => <field.TextInput label="Name" required placeholder="Workflow name" />}
        </form.AppField>

        <form.AppField name="description">
          {(field) => <field.TextInput label="Description" placeholder="Optional description" />}
        </form.AppField>
      </Stack>
    );
  },
});
