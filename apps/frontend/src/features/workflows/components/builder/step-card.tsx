import { Badge, Card, HStack, IconButton, Input, Separator, Stack } from "@chakra-ui/react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { LuChevronDown, LuChevronUp, LuCopy, LuTrash } from "react-icons/lu";
import { Field } from "@/components/ui";
import { ModelProfileSingleSelect } from "@/features/inference-config/components/model-profile-selector";
import { TemplateSingleSelect } from "@/features/templates/components/template-selector";
import { GenParamsTextarea, StopSequencesTextarea } from "./json-editors";
import { OutputsEditor } from "./outputs-editor";
import type { WorkflowFormValues } from "./schemas";
import { StepHeaderLabels } from "./step-header-labels";
import { TransformsEditor } from "./transforms-editor";

export function StepCard({
  index,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  isSubmitting,
}: {
  index: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  isSubmitting: boolean;
}) {
  const { register, control, formState, setValue } = useFormContext<WorkflowFormValues>();
  const namePath = `steps.${index}.name` as const;
  const modelPath = `steps.${index}.modelProfileId` as const;
  const templatePath = `steps.${index}.promptTemplateId` as const;
  const stopPath = `steps.${index}.stop` as const;
  const maxOutPath = `steps.${index}.maxOutputTokens` as const;
  const maxCtxPath = `steps.${index}.maxContextTokens` as const;
  const genParamsPath = `steps.${index}.genParams` as const;
  const task = useWatch({ control, name: "task" });
  const modelValue = useWatch({ control, name: modelPath }) as string;
  const templateValue = useWatch({ control, name: templatePath }) as string;

  type StepErrorShape = Partial<{
    modelProfileId: { message?: string };
    promptTemplateId: { message?: string };
    stop: { message?: string };
    maxOutputTokens: { message?: string };
    maxContextTokens: { message?: string };
    genParams: { message?: string };
  }>;
  const stepErr = formState.errors?.steps?.[index] as unknown as StepErrorShape | undefined;
  const stepHasErrors = Boolean(stepErr);

  return (
    <Card.Root layerStyle="surface">
      <Stack p={4} gap={3}>
        <HStack justify="space-between" align="center">
          <HStack gap={2} wrap="wrap">
            <Badge>Step {index + 1}</Badge>
            {stepHasErrors && <Badge colorPalette="red">Has issues</Badge>}
            <StepHeaderLabels
              modelProfileId={modelValue || undefined}
              templateId={templateValue || undefined}
            />
          </HStack>
          <HStack gap={1}>
            <IconButton
              aria-label="Move up"
              size="xs"
              variant="ghost"
              onClick={onMoveUp}
              disabled={isSubmitting}
            >
              <LuChevronUp />
            </IconButton>
            <IconButton
              aria-label="Move down"
              size="xs"
              variant="ghost"
              onClick={onMoveDown}
              disabled={isSubmitting}
            >
              <LuChevronDown />
            </IconButton>
            <IconButton
              aria-label="Duplicate"
              size="xs"
              variant="ghost"
              onClick={onDuplicate}
              disabled={isSubmitting}
            >
              <LuCopy />
            </IconButton>
            <IconButton
              aria-label="Delete"
              variant="ghost"
              colorPalette="red"
              size="xs"
              onClick={onRemove}
              disabled={isSubmitting}
            >
              <LuTrash />
            </IconButton>
          </HStack>
        </HStack>

        <Field label="Step Name" helperText="For reference; not used in prompts">
          <Input {...register(namePath)} placeholder="Brief step label" disabled={isSubmitting} />
        </Field>

        <Stack direction="row" gap={3} wrap="wrap">
          <Field
            label="Model Profile"
            flex={1}
            required
            invalid={!!stepErr?.modelProfileId}
            errorText={stepErr?.modelProfileId?.message}
            helperText="Model and provider to use for this step"
          >
            <Controller
              name={modelPath}
              control={control}
              render={({ field }) => (
                <ModelProfileSingleSelect
                  value={field.value ? String(field.value) : null}
                  onChange={(id) => field.onChange(id ?? "")}
                  disabled={isSubmitting}
                />
              )}
            />
          </Field>
          <Field
            label="Prompt Template"
            flex={1}
            required
            invalid={!!stepErr?.promptTemplateId}
            errorText={stepErr?.promptTemplateId?.message}
            helperText="Prompt template used for the model call"
          >
            <Controller
              name={templatePath}
              control={control}
              render={({ field }) => (
                <TemplateSingleSelect
                  task={task}
                  value={field.value ? String(field.value) : null}
                  onChange={(id) => field.onChange(id ?? "")}
                  disabled={isSubmitting}
                />
              )}
            />
          </Field>
        </Stack>

        <Field
          label="Stop Sequences (JSON array)"
          helperText='Example: ["###", "<END>"]'
          invalid={!!stepErr?.stop}
          errorText={stepErr?.stop?.message}
        >
          <Controller
            control={control}
            name={stopPath}
            render={({ field }) => (
              <StopSequencesTextarea
                name={field.name}
                value={Array.isArray(field.value) ? field.value : []}
                onChangeArray={(arr) => field.onChange(arr)}
                disabled={isSubmitting}
              />
            )}
          />
        </Field>

        <Stack direction="row" gap={3} wrap="wrap">
          <Field
            label="Max Output Tokens"
            flex={1}
            invalid={!!stepErr?.maxOutputTokens}
            errorText={stepErr?.maxOutputTokens?.message}
            helperText="Limit on the number of tokens generated"
          >
            <Input
              type="number"
              placeholder="auto"
              disabled={isSubmitting}
              {...register(maxOutPath, {
                setValueAs: (v) =>
                  v === "" || v === null || Number.isNaN(v) ? undefined : Number(v),
              })}
            />
          </Field>
          <Field
            label="Max Context Tokens"
            flex={1}
            invalid={!!stepErr?.maxContextTokens}
            errorText={stepErr?.maxContextTokens?.message}
            helperText="Has precedence over prompt template settings"
          >
            <Input
              type="number"
              placeholder="auto"
              disabled={isSubmitting}
              {...register(maxCtxPath, {
                setValueAs: (v) =>
                  v === "" || v === null || Number.isNaN(v) ? undefined : Number(v),
              })}
            />
          </Field>
        </Stack>

        <Separator />

        <TransformsEditor stepIndex={index} disabled={isSubmitting} />

        <Separator />

        <OutputsEditor stepIndex={index} disabled={isSubmitting} />

        <Separator />

        <Field
          label="Generation Params (JSON)"
          invalid={!!stepErr?.genParams}
          errorText={stepErr?.genParams?.message}
        >
          <Controller
            control={control}
            name={genParamsPath}
            render={({ field }) => (
              <GenParamsTextarea
                name={genParamsPath}
                value={field.value}
                onChangeObject={(obj) => setValue(genParamsPath, obj, { shouldDirty: true })}
                disabled={isSubmitting}
              />
            )}
          />
        </Field>
      </Stack>
    </Card.Root>
  );
}
