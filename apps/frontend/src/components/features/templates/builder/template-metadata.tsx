import {
  Accordion,
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
import {
  type Control,
  Controller,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { LuFileText, LuSettings, LuTag } from "react-icons/lu";
import {
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui";
import type { TemplateFormData } from "../template-form-schema";

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

const responseFormatOptions = [
  { label: "Text", value: "text", description: "Plain text response" },
  { label: "JSON", value: "json", description: "JSON object response" },
  {
    label: "JSON Schema",
    value: "json_schema",
    description: "Structured JSON with schema validation",
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
  const selectedFormat = responseFormatOptions.find(
    (f) => f.value === watchedValues.responseFormat
  );

  return (
    <Card.Root layerStyle="surface">
      <Stack p={6} gap={4}>
        {/* Header */}
        <HStack gap={3}>
          <LuFileText size={20} />
          <VStack align="start" gap={0}>
            <Heading size="md" textStyle="heading">
              Template Information
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
            <Input
              {...register("name")}
              placeholder="Enter template name"
              autoComplete="off"
            />
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

        <Separator />

        {/* Advanced Options */}
        <Accordion.Root collapsible>
          <Accordion.Item value="response-format">
            <Accordion.ItemTrigger>
              <HStack>
                <LuSettings size={16} />
                <Text>Response Format</Text>
                {selectedFormat && (
                  <Badge size="sm">{selectedFormat.label}</Badge>
                )}
              </HStack>
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody>
                <Stack gap={4}>
                  <Field
                    label="Format Type"
                    helperText={selectedFormat?.description}
                  >
                    <Controller
                      name="responseFormat"
                      control={control}
                      render={({ field }) => (
                        <SelectRoot
                          collection={createListCollection({
                            items: responseFormatOptions,
                          })}
                          value={field.value ? [String(field.value)] : []}
                          onValueChange={(details) => {
                            const value = details.value[0];
                            if (value === "text" || value === "json") {
                              field.onChange(value);
                            } else if (value === "json_schema") {
                              field.onChange({
                                type: "json_schema",
                                schema: { type: "object", properties: {} },
                              });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValueText placeholder="Select response format" />
                          </SelectTrigger>
                          <SelectContent>
                            {responseFormatOptions.map((option) => (
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

                  {typeof watchedValues.responseFormat === "object" &&
                    watchedValues.responseFormat?.type === "json_schema" && (
                      <Field
                        label="JSON Schema"
                        helperText="Define the structure for the JSON response"
                      >
                        <Textarea
                          placeholder='{"type": "object", "properties": {...}}'
                          rows={6}
                          fontFamily="mono"
                          fontSize="sm"
                          // Note: We'd need to implement schema editing here
                          readOnly
                          bg="surface.muted"
                          value="JSON schema editing is not yet implemented"
                        />
                      </Field>
                    )}
                </Stack>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>

          <Accordion.Item value="transforms">
            <Accordion.ItemTrigger>
              <HStack>
                <LuTag size={16} />
                <Text>Response Transforms</Text>
                <Badge size="sm" colorPalette="neutral">
                  Optional
                </Badge>
              </HStack>
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody>
                <VStack align="start" gap={2}>
                  <Text fontSize="sm" color="content.muted">
                    Response transforms allow you to post-process the model's
                    output using regex patterns.
                  </Text>
                  <Text fontSize="sm" color="content.muted">
                    This feature is not yet implemented in the UI. Use JSON
                    export/import for complex transforms.
                  </Text>
                </VStack>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>
        </Accordion.Root>
      </Stack>
    </Card.Root>
  );
}
