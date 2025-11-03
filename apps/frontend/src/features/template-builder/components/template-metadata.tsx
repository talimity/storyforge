import { Stack } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { LuFileText } from "react-icons/lu";
import { TabHeader } from "@/components/ui/tab-header";
import { TaskKindSelect, taskKindOptions } from "@/components/ui/task-kind-select";
import type { TemplateFormData } from "@/features/template-builder/template-form-schema";
import { withForm } from "@/lib/app-form";

const fallbackTask = taskKindOptions[0]?.value ?? "turn_generation";

const metadataDefaultValues = {
  name: "",
  task: fallbackTask,
  description: "",
} satisfies TemplateFormData & { description: string };

export const TemplateMetadata = withForm({
  defaultValues: metadataDefaultValues,
  props: { isEditMode: false },
  render: function Render({ form, isEditMode = false }) {
    const task = useStore(form.store, (state) => state.values.task);
    const selectedTask = taskKindOptions.find((option) => option.value === task);

    return (
      <Stack gap={6}>
        <TabHeader
          title="Prompt Template Information"
          description="Basic metadata and configuration"
          icon={LuFileText}
        />

        <Stack gap={4}>
          <form.AppField name="name">
            {(field) => (
              <field.TextInput
                label="Template Name"
                placeholder="Enter template name"
                autoComplete="off"
                required
              />
            )}
          </form.AppField>

          <form.AppField name="task">
            {(field) => (
              <field.Field label="Task Type" helperText={selectedTask?.description} required>
                <TaskKindSelect
                  value={field.state.value}
                  onChange={(value) => {
                    if (!value) return;
                    field.handleChange(value);
                    field.handleBlur();
                  }}
                  disabled={isEditMode}
                  placeholder="Select task kind"
                />
              </field.Field>
            )}
          </form.AppField>

          <form.AppField name="description">
            {(field) => (
              <field.TextareaInput
                label="Description"
                helperText="Optional description of what this template does"
                placeholder="Describe the purpose and usage of this template..."
                autosize
                minRows={3}
              />
            )}
          </form.AppField>
        </Stack>
      </Stack>
    );
  },
});
