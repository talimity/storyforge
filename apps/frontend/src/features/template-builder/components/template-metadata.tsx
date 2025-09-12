import {
  Card,
  Heading,
  HStack,
  Input,
  Separator,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { type Control, Controller, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { LuFileText } from "react-icons/lu";
import { Field } from "@/components/ui/index";
import { TaskKindSelect, taskKindOptions } from "@/components/ui/task-kind-select";
import type { TemplateFormData } from "@/features/template-builder/template-form-schema";

interface TemplateMetadataProps {
  register: UseFormRegister<TemplateFormData>;
  control: Control<TemplateFormData>;
  errors: FieldErrors<TemplateFormData>;
  watchedValues: TemplateFormData;
  isEditMode?: boolean;
}

export function TemplateMetadata({
  register,
  control,
  errors,
  watchedValues,
  isEditMode = false,
}: TemplateMetadataProps) {
  const selectedTask = taskKindOptions.find((t) => t.value === watchedValues.task);

  return (
    <Card.Root layerStyle="surface">
      <Stack p={6} gap={4}>
        {/* Header */}
        <HStack gap={3}>
          <LuFileText size={20} />
          <VStack align="start" gap={0}>
            <Heading size="md">Prompt Template Information</Heading>
            <Text color="content.muted" fontSize="sm">
              Basic metadata and configuration
            </Text>
          </VStack>
        </HStack>

        <Separator />

        {/* Basic Information */}
        <Stack gap={4}>
          <Field
            label="Template Name"
            required
            errorText={errors.name?.message}
            invalid={!!errors.name}
          >
            <Input {...register("name")} placeholder="Enter template name" autoComplete="off" />
          </Field>

          <Field
            label="Task Type"
            helperText={selectedTask?.description}
            errorText={errors.task?.message}
            invalid={!!errors.task}
          >
            <Controller
              name="task"
              control={control}
              render={({ field }) => (
                <TaskKindSelect
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  disabled={isEditMode}
                  placeholder="Select task kind"
                />
              )}
            />
          </Field>

          <Field
            label="Description"
            helperText="Optional description of what this template does"
            errorText={errors.description?.message}
            invalid={!!errors.description}
          >
            <Textarea
              {...register("description")}
              placeholder="Describe the purpose and usage of this template..."
              rows={3}
              autoresize
            />
          </Field>
        </Stack>
      </Stack>
    </Card.Root>
  );
}
