import { Badge, Card, HStack, IconButton, Separator, Stack } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { LuChevronDown, LuChevronUp, LuCopy, LuTrash } from "react-icons/lu";
import { ModelProfileSingleSelect } from "@/features/inference-config/components/model-profile-selector";
import { TemplateSingleSelect } from "@/features/templates/components/template-selector";
import { withFieldGroup } from "@/lib/app-form";
import type { WorkflowFormValues } from "./form-schemas";
import { GenParamsTextarea, StopSequencesTextarea } from "./json-editors";
import { OutputsEditor } from "./outputs-editor";
import { StepHeaderLabels } from "./step-header-labels";
import { TransformsEditor } from "./transforms-editor";

const emptyStep: WorkflowFormValues["steps"][0] = {
  id: "",
  name: undefined,
  modelProfileId: "",
  promptTemplateId: "",
  genParams: undefined,
  stop: [],
  maxOutputTokens: undefined,
  maxContextTokens: undefined,
  transforms: [],
  outputs: [{ key: "content", capture: "assistantText" }],
};

type StepCardProps = {
  task: WorkflowFormValues["task"];
  index: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
};

export const StepCard = withFieldGroup({
  defaultValues: emptyStep,
  props: {
    index: 0,
    onRemove: () => {},
    onMoveUp: () => {},
    onMoveDown: () => {},
    onDuplicate: () => {},
    task: "turn_generation",
    //satisfies ensures the props object matches, but then we need to use an
    //assertion to widen literals or `index` is inferred as `0` instead of `number`
  } satisfies StepCardProps as StepCardProps,
  render: function Render({ group, task, index, onRemove, onMoveUp, onMoveDown, onDuplicate }) {
    const modelProfileId = useStore(group.store, (s) => s.values.modelProfileId);
    const templateId = useStore(group.store, (s) => s.values.promptTemplateId);

    // no obvious way to get `group.meta` to see isValid
    const hasErrors = Object.keys(group.fieldsMap).some((key) => {
      const meta = group.getFieldMeta(key as keyof typeof group.fieldsMap);
      return Boolean(meta?.errors?.length);
    });

    return (
      <Card.Root layerStyle="surface">
        <Stack p={4} gap={3}>
          <HStack justify="space-between" align="center">
            <HStack gap={2} wrap="wrap">
              <Badge>Step {index + 1}</Badge>
              {hasErrors && <Badge colorPalette="red">Has issues</Badge>}
              <StepHeaderLabels
                modelProfileId={modelProfileId || undefined}
                templateId={templateId || undefined}
              />
            </HStack>
            <HStack gap={1}>
              <IconButton aria-label="Move up" size="xs" variant="ghost" onClick={onMoveUp}>
                <LuChevronUp />
              </IconButton>
              <IconButton aria-label="Move down" size="xs" variant="ghost" onClick={onMoveDown}>
                <LuChevronDown />
              </IconButton>
              <IconButton aria-label="Duplicate" size="xs" variant="ghost" onClick={onDuplicate}>
                <LuCopy />
              </IconButton>
              <IconButton
                aria-label="Delete"
                variant="ghost"
                colorPalette="red"
                size="xs"
                onClick={onRemove}
              >
                <LuTrash />
              </IconButton>
            </HStack>
          </HStack>

          <group.AppField name="name">
            {(field) => (
              <field.TextInput
                label="Step Name"
                helperText="For reference only (not used in prompts)"
                autoComplete="off"
                placeholder="e.g., plan, draft, write, etc."
              />
            )}
          </group.AppField>

          <Stack direction={{ base: "column", md: "row" }} gap={3}>
            <group.AppField name="modelProfileId">
              {(field) => (
                <field.Field
                  label="Model Profile"
                  flex={1}
                  required
                  helperText="Model and inference provider used for this step"
                >
                  <ModelProfileSingleSelect
                    value={field.state.value ? String(field.state.value) : null}
                    onChange={(id) => field.handleChange(id ?? "")}
                  />
                </field.Field>
              )}
            </group.AppField>
            <group.AppField name="promptTemplateId">
              {(field) => (
                <field.Field
                  label="Prompt Template"
                  flex={1}
                  required
                  helperText="Prompt template used for the model call"
                >
                  <TemplateSingleSelect
                    task={task}
                    value={field.state.value ? String(field.state.value) : null}
                    onChange={(id) => field.handleChange(id ?? "")}
                  />
                </field.Field>
              )}
            </group.AppField>
          </Stack>

          <group.AppField name="stop">
            {(field) => (
              <field.Field
                label="Stop Sequences (JSON array)"
                helperText='Example: ["###", "<END>"]'
              >
                <StopSequencesTextarea />
              </field.Field>
            )}
          </group.AppField>

          <Stack direction="row" gap={3} wrap="wrap">
            <group.AppField name="maxContextTokens">
              {(field) => (
                <field.NumberInput
                  label="Max Context Size (tokens)"
                  helperText="Has precedence over prompt template settings"
                  placeholder="auto"
                  allowEmpty
                  fieldProps={{ flex: "1" }}
                />
              )}
            </group.AppField>
            <group.AppField name="maxOutputTokens">
              {(field) => (
                <field.NumberInput
                  label="Max Response Tokens"
                  helperText="Uses model/provider default if not specified"
                  placeholder="auto"
                  allowEmpty
                  fieldProps={{ flex: "1" }}
                />
              )}
            </group.AppField>
          </Stack>

          <Separator />

          <TransformsEditor form={group} fields={{ items: "transforms" }} />

          <Separator />

          <OutputsEditor form={group} fields={{ items: "outputs" }} />

          <Separator />

          <group.AppField name="genParams">
            {(field) => (
              <field.Field label="Extra Generation Params (JSON)">
                <GenParamsTextarea />
              </field.Field>
            )}
          </group.AppField>
        </Stack>
      </Card.Root>
    );
  },
});
