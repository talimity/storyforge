import {
  Accordion,
  Badge,
  createListCollection,
  HStack,
  Icon,
  IconButton,
  Input,
  NumberInput,
  Span,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import type { ChatCompletionMessageRole } from "@storyforge/prompt-rendering";
import { slotSpecSchema } from "@storyforge/prompt-rendering";
import { useStore } from "@tanstack/react-form";
import { useEffect } from "react";
import { LuCheck, LuX } from "react-icons/lu";
import { z } from "zod";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  Switch,
} from "@/components/ui";
import { NodeFrame } from "@/features/template-builder/components/nodes/node-frame";
import { ParameterInput } from "@/features/template-builder/components/parameter-inputs";
import type { TemplateVariable } from "@/features/template-builder/components/template-string-editor";
import {
  getNodeIcon,
  MESSAGE_ROLE_SELECT_OPTIONS,
} from "@/features/template-builder/services/builder-utils";
import { getRecipeById } from "@/features/template-builder/services/recipe-registry";
import {
  createRecipeParametersSchema,
  slotBudgetSchema,
  slotNameSchema,
  slotPrioritySchema,
} from "@/features/template-builder/services/slot-validation";
import { useTemplateBuilderStore } from "@/features/template-builder/stores/template-builder-store";
import type {
  RecipeParamSpec,
  SlotDraft,
  SlotLayoutDraft,
} from "@/features/template-builder/types";
import { formatFormError, useAppForm } from "@/lib/app-form";

interface SlotReferenceEditProps {
  node: SlotLayoutDraft;
  slot: SlotDraft;
  isDragging?: boolean;
  onSave?: (node: SlotLayoutDraft, slot: SlotDraft) => void;
  onCancel?: () => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
  containerRef?: React.Ref<HTMLDivElement>;
}

const roleOptionsCollection = createListCollection({ items: MESSAGE_ROLE_SELECT_OPTIONS });

type SlotEditFormValues = {
  name: string;
  priority: number;
  budget?: number;
  params: Record<string, unknown>;
  omitIfEmpty: boolean;
  headerContent: string;
  headerRole: ChatCompletionMessageRole;
  footerContent: string;
  footerRole: ChatCompletionMessageRole;
  customSpec: string;
};

export function SlotReferenceEdit(props: SlotReferenceEditProps) {
  const {
    node,
    slot,
    isDragging = false,
    onSave,
    onCancel,
    dragHandleProps,
    style,
    containerRef,
  } = props;

  const NodeIcon = getNodeIcon(node);
  const slotsDraft = useTemplateBuilderStore((state) => state.slotsDraft);

  const recipe = slot.recipeId !== "custom" ? getRecipeById(slot.recipeId) : undefined;
  const availableVariables: TemplateVariable[] = recipe?.availableVariables ?? [];

  const paramsSchema = createRecipeParametersSchema(recipe?.parameters ?? []);

  const formSchema = z.object({
    name: slotNameSchema.refine((name) => name === slot.name || !(name in slotsDraft), {
      message: "Another content block already uses this ID",
    }),
    priority: slotPrioritySchema,
    budget: slotBudgetSchema.optional().transform((value) => value ?? undefined),
    params: paramsSchema,
    omitIfEmpty: z.boolean(),
    headerContent: z.string().optional(),
    headerRole: z.enum(["system", "user", "assistant"]),
    footerContent: z.string().optional(),
    footerRole: z.enum(["system", "user", "assistant"]),
    customSpec: z
      .string()
      .optional()
      .superRefine((value, ctx) => {
        if (!value?.trim()) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(value);
        } catch {
          ctx.addIssue({ code: "custom", message: "Invalid JSON" });
          return;
        }
        const result = slotSpecSchema.safeParse(parsed);
        if (!result.success) {
          ctx.addIssue({ code: "custom", message: result.error.message });
        }
      }),
  });

  const defaultValues = {
    name: node.name || "",
    priority: slot.priority,
    budget: slot.budget,
    params: slot.params,
    omitIfEmpty: node.omitIfEmpty ?? true,
    headerContent: node.header?.content || "",
    headerRole: node.header?.role ?? "user",
    footerContent: node.footer?.content || "",
    footerRole: node.footer?.role ?? "user",
    customSpec: slot.customSpec ?? "{}",
  } satisfies SlotEditFormValues;

  const form = useAppForm({
    defaultValues,
    validators: {
      onBlur: ({ value }) => {
        const result = formSchema.safeParse(value);
        if (result.success) return undefined;

        const fieldErrors: Record<string, unknown> = {};

        for (const issue of result.error.issues) {
          const key = issue.path.join(".");
          if (!key) continue;
          if (fieldErrors[key]) continue;
          fieldErrors[key] = issue.message;
        }

        return { fields: fieldErrors };
      },
    },
    onSubmit: ({ value }) => {
      const updatedNode: SlotLayoutDraft = {
        ...node,
        name: value.name,
        omitIfEmpty: value.omitIfEmpty,
        header: value.headerContent
          ? { role: value.headerRole, content: value.headerContent }
          : undefined,
        footer: value.footerContent
          ? { role: value.footerRole, content: value.footerContent }
          : undefined,
      };

      const isCustomRecipe = (slot.recipeId ?? "custom") === "custom";
      const updatedSlot: SlotDraft = {
        ...slot,
        name: value.name,
        priority: value.priority,
        budget: value.budget,
        params: value.params,
        customSpec: isCustomRecipe && value.customSpec?.trim() ? value.customSpec : undefined,
      };

      onSave?.(updatedNode, updatedSlot);
    },
  });

  useEffect(() => {
    form.reset({
      name: node.name || "",
      priority: slot.priority,
      budget: slot.budget,
      params: slot.params,
      omitIfEmpty: node.omitIfEmpty ?? true,
      headerContent: node.header?.content || "",
      headerRole: node.header?.role ?? "user",
      footerContent: node.footer?.content || "",
      footerRole: node.footer?.role ?? "user",
      customSpec: slot.customSpec ?? "{}",
    } satisfies SlotEditFormValues);
  }, [form, node, slot]);

  const canSubmit = useStore(form.store, (state) => state.canSubmit);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <NodeFrame
      containerRef={containerRef}
      node={node}
      isDragging={isDragging}
      dragHandleProps={dragHandleProps}
      style={style}
    >
      <VStack align="stretch" gap={4}>
        <HStack gap={2} align="center">
          <Icon as={NodeIcon} />
          <Badge size="sm">Content Block</Badge>
          <Text fontSize="sm" fontWeight="medium" flex={1}>
            Editing '{node.name}'
          </Text>
          <HStack gap={1}>
            <IconButton
              size="xs"
              colorPalette="green"
              onClick={() => form.handleSubmit()}
              aria-label="Save block"
              disabled={!canSubmit || isSubmitting}
            >
              <LuCheck />
            </IconButton>
            <IconButton
              size="xs"
              variant="ghost"
              onClick={onCancel}
              aria-label="Cancel edit"
              disabled={isSubmitting}
            >
              <LuX />
            </IconButton>
          </HStack>
        </HStack>

        <VStack align="stretch" gap={4}>
          {recipe?.name && recipe?.description && (
            <Text fontSize="xs" color="content.muted">
              {recipe.name}: {recipe.description}
            </Text>
          )}

          <Stack gap={3} direction={{ base: "column", lg: "row" }}>
            <form.AppField name="name">
              {(field) => (
                <field.Field
                  label="Content Block ID"
                  helperText="Unique ID within this template"
                  required
                  errorText={formatFormError(field.state.meta.errors[0])}
                  invalid={field.state.meta.errors.length > 0}
                  flex={1}
                >
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value ?? ""}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={() => field.handleBlur()}
                    autoComplete="off"
                  />
                </field.Field>
              )}
            </form.AppField>

            <form.AppField name="priority">
              {(field) => (
                <field.Field
                  label="Priority"
                  helperText="Higher priority blocks render first when budgets are tight"
                  required
                  errorText={formatFormError(field.state.meta.errors[0])}
                  invalid={field.state.meta.errors.length > 0}
                  flex={1}
                >
                  <NumberInput.Root
                    value={String(field.state.value ?? 0)}
                    min={0}
                    max={100}
                    onValueChange={({ valueAsNumber }) => {
                      if (Number.isNaN(valueAsNumber)) return;
                      const clamped = Math.min(Math.max(valueAsNumber, 0), 100);
                      field.handleChange(clamped);
                    }}
                  >
                    <NumberInput.Input onBlur={() => field.handleBlur()} />
                    <NumberInput.Control>
                      <NumberInput.IncrementTrigger />
                      <NumberInput.DecrementTrigger />
                    </NumberInput.Control>
                  </NumberInput.Root>
                </field.Field>
              )}
            </form.AppField>

            <form.AppField name="budget">
              {(field) => (
                <field.Field
                  label="Token Budget"
                  helperText="Leave blank to allow automatic budgeting"
                  errorText={formatFormError(field.state.meta.errors[0])}
                  invalid={field.state.meta.errors.length > 0}
                  flex={1}
                >
                  <NumberInput.Root
                    value={field.state.value == null ? "" : String(field.state.value)}
                    min={50}
                    onValueChange={({ valueAsNumber }) => {
                      if (Number.isNaN(valueAsNumber)) {
                        field.handleChange(undefined);
                        return;
                      }
                      field.handleChange(valueAsNumber);
                    }}
                  >
                    <NumberInput.Input placeholder="Automatic" onBlur={() => field.handleBlur()} />
                    <NumberInput.Control>
                      <NumberInput.IncrementTrigger />
                      <NumberInput.DecrementTrigger />
                    </NumberInput.Control>
                  </NumberInput.Root>
                </field.Field>
              )}
            </form.AppField>
          </Stack>

          {recipe && recipe.parameters.length > 0 && (
            <Accordion.Root collapsible defaultValue={["recipe-params"]} width="full">
              <Accordion.Item value="recipe-params">
                <Accordion.ItemTrigger>
                  <Span flex="1">Block Configuration</Span>
                  <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                  <Accordion.ItemBody px={0}>
                    <VStack align="stretch" gap={3} width="full">
                      {recipe.parameters.map((param: RecipeParamSpec) => (
                        <form.AppField key={param.key} name={`params.${param.key}`}>
                          {(field) => (
                            <ParameterInput
                              param={param}
                              value={field.state.value}
                              onChange={(value) => {
                                field.handleChange(value);
                                field.handleBlur();
                              }}
                              availableVariables={availableVariables}
                              isInvalid={field.state.meta.errors.length > 0}
                              errorText={formatFormError(field.state.meta.errors[0])}
                            />
                          )}
                        </form.AppField>
                      ))}
                    </VStack>
                  </Accordion.ItemBody>
                </Accordion.ItemContent>
              </Accordion.Item>
            </Accordion.Root>
          )}

          {!recipe && (
            <VStack align="stretch" gap={3}>
              <Text fontSize="xs" color="content.muted">
                This content block does not use a predefined recipe. Provide a JSON specification
                for the block below.
              </Text>
              <form.AppField name="customSpec">
                {(field) => (
                  <field.Field
                    label="Content JSON"
                    errorText={formatFormError(field.state.meta.errors[0])}
                    invalid={field.state.meta.errors.length > 0}
                  >
                    <Textarea
                      value={field.state.value ?? ""}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={() => field.handleBlur()}
                      rows={4}
                      fontFamily="mono"
                      placeholder="{ }"
                    />
                  </field.Field>
                )}
              </form.AppField>
            </VStack>
          )}

          <Accordion.Root collapsible width="full">
            <Accordion.Item value="headers-footers">
              <Accordion.ItemTrigger>
                <Span flex="1">Headers & Footers</Span>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody px={0}>
                  <VStack align="stretch" gap={4} width="full">
                    <Stack gap={3} direction={{ base: "column", lg: "row" }}>
                      <form.AppField name="headerContent">
                        {(field) => (
                          <field.Field
                            label="Header"
                            helperText="Text displayed before content"
                            flex={2}
                          >
                            <Textarea
                              value={field.state.value ?? ""}
                              onChange={(event) => field.handleChange(event.target.value)}
                              onBlur={() => field.handleBlur()}
                              rows={2}
                              placeholder="Optional header"
                            />
                          </field.Field>
                        )}
                      </form.AppField>
                      <form.AppField name="headerRole">
                        {(field) => (
                          <field.Field label="Header Role" flex={1}>
                            <SelectRoot
                              collection={roleOptionsCollection}
                              value={[field.state.value]}
                              onValueChange={(details) => {
                                const nextRole = details.value[0] as ChatCompletionMessageRole;
                                field.handleChange(nextRole);
                                field.handleBlur();
                              }}
                            >
                              <SelectTrigger>
                                <SelectValueText placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                {MESSAGE_ROLE_SELECT_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} item={option}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </SelectRoot>
                          </field.Field>
                        )}
                      </form.AppField>
                    </Stack>

                    <Stack gap={3} direction={{ base: "column", lg: "row" }}>
                      <form.AppField name="footerContent">
                        {(field) => (
                          <field.Field
                            label="Footer"
                            helperText="Text displayed after content"
                            flex={2}
                          >
                            <Textarea
                              value={field.state.value ?? ""}
                              onChange={(event) => field.handleChange(event.target.value)}
                              onBlur={() => field.handleBlur()}
                              rows={2}
                              placeholder="Optional footer"
                            />
                          </field.Field>
                        )}
                      </form.AppField>
                      <form.AppField name="footerRole">
                        {(field) => (
                          <field.Field label="Footer Role" flex={1}>
                            <SelectRoot
                              collection={roleOptionsCollection}
                              value={[field.state.value]}
                              onValueChange={(details) => {
                                const nextRole = details.value[0] as ChatCompletionMessageRole;
                                field.handleChange(nextRole);
                                field.handleBlur();
                              }}
                            >
                              <SelectTrigger>
                                <SelectValueText placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                {MESSAGE_ROLE_SELECT_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} item={option}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </SelectRoot>
                          </field.Field>
                        )}
                      </form.AppField>
                    </Stack>

                    <form.AppField name="omitIfEmpty">
                      {(field) => (
                        <field.Field helperText="Skip the block entirely when it produces no content">
                          <Switch
                            checked={Boolean(field.state.value)}
                            onCheckedChange={({ checked }) => field.handleChange(Boolean(checked))}
                            onBlur={() => field.handleBlur()}
                          >
                            Skip block if empty
                          </Switch>
                        </field.Field>
                      )}
                    </form.AppField>
                  </VStack>
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          </Accordion.Root>
        </VStack>
      </VStack>
    </NodeFrame>
  );
}
