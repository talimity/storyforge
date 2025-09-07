import {
  Badge,
  Card,
  createListCollection,
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
import {
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui/index";
import type { TemplateFormData } from "@/features/template-builder/template-form-schema";

interface TemplateMetadataProps {
  register: UseFormRegister<TemplateFormData>;
  control: Control<TemplateFormData>;
  errors: FieldErrors<TemplateFormData>;
  watchedValues: TemplateFormData;
  isEditMode?: boolean;
}

const taskOptions = [
  {
    label: "Turn Generation",
    value: "turn_generation",
    description: "Generate narrative turns for story progression",
  },
  {
    label: "Chapter Summarization",
    value: "chapter_summarization",
    description: "Create summaries of completed story chapters",
  },
  {
    label: "Writing Assistant",
    value: "writing_assistant",
    description: "General writing assistance and text improvement",
  },
];

export function TemplateMetadata({
  register,
  control,
  errors,
  watchedValues,
  isEditMode = false,
}: TemplateMetadataProps) {
  const selectedTask = taskOptions.find((t) => t.value === watchedValues.task);

  return (
    <Card.Root layerStyle="surface">
      <Stack p={6} gap={4}>
        {/* Header */}
        <HStack gap={3}>
          <LuFileText size={20} />
          <VStack align="start" gap={0}>
            <Heading size="md" textStyle="heading">
              Prompt Template Information
            </Heading>
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
                <SelectRoot
                  collection={createListCollection({ items: taskOptions })}
                  value={[field.value]}
                  onValueChange={(details) => {
                    field.onChange(details.value[0]);
                  }}
                  disabled={isEditMode} // Don't allow changing task type in edit mode
                >
                  <SelectTrigger>
                    <HStack>
                      <SelectValueText placeholder="Select task type" />
                      {isEditMode && (
                        <Badge size="sm" colorPalette="neutral">
                          Read-only
                        </Badge>
                      )}
                    </HStack>
                  </SelectTrigger>
                  <SelectContent>
                    {taskOptions.map((option) => (
                      <SelectItem key={option.value} item={option}>
                        <VStack align="start" gap={1}>
                          <Text>{option.label}</Text>
                          <Text fontSize="xs" color="content.muted">
                            {option.description}
                          </Text>
                        </VStack>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
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
