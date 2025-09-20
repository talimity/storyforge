import { Heading, HStack, Input, Stack, Text, VStack } from "@chakra-ui/react";
import { useFormContext } from "react-hook-form";
import { LuFileText } from "react-icons/lu";
import { Field } from "@/components/ui";
import { TaskKindSelect } from "@/components/ui/task-kind-select";
import type { WorkflowFormValues } from "./schemas";

export function WorkflowDetailsTab({
  isEditMode,
  isSubmitting,
}: {
  isEditMode?: boolean;
  isSubmitting?: boolean;
}) {
  const { register, getValues, setValue, formState } = useFormContext<WorkflowFormValues>();

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

      <Field
        label="Task"
        required
        invalid={!!formState.errors.task}
        errorText={formState.errors.task?.message}
      >
        <TaskKindSelect
          value={getValues("task")}
          onChange={(val) => {
            setValue("task", val as WorkflowFormValues["task"], { shouldDirty: true });
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
          {...register("name")}
          autoComplete="off"
          placeholder="Workflow name"
          disabled={isSubmitting}
        />
      </Field>

      <Field label="Description">
        <Input
          {...register("description")}
          autoComplete="off"
          placeholder="Optional description"
          disabled={isSubmitting}
        />
      </Field>
    </Stack>
  );
}
