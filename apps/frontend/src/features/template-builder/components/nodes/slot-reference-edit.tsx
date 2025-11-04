import {
  Accordion,
  Badge,
  HStack,
  Icon,
  IconButton,
  Span,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  type ChatCompletionMessageRole,
  jsonSchema,
  slotSpecSchema,
} from "@storyforge/prompt-rendering";
import { useStore } from "@tanstack/react-form";
import { useEffect } from "react";
import { LuCheck, LuX } from "react-icons/lu";
import { z } from "zod";
import { NodeFrame } from "@/features/template-builder/components/nodes/node-frame";
import { ParamInputGroup } from "@/features/template-builder/components/param-inputs";
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
  MessageBlockDraft,
  SlotDraft,
  SlotFrameNodeDraft,
  SlotLayoutDraft,
} from "@/features/template-builder/types";
import { useAppForm } from "@/lib/form/app-form";
import { jsonText } from "@/lib/form/json-text-zod";

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

const isAnchorNode = (
  node: SlotFrameNodeDraft
): node is Extract<SlotFrameNodeDraft, { kind: "anchor" }> =>
  "kind" in node && node.kind === "anchor";

const isMessageNode = (node: SlotFrameNodeDraft): node is MessageBlockDraft => !isAnchorNode(node);

function firstMessageNode(frames?: SlotFrameNodeDraft[]): MessageBlockDraft | undefined {
  return frames?.find(isMessageNode);
}

function updateFrameCollection(
  frames: SlotFrameNodeDraft[] | undefined,
  message: MessageBlockDraft | undefined
): SlotFrameNodeDraft[] | undefined {
  if (!frames || frames.length === 0) {
    return message ? [message] : undefined;
  }

  const next = [...frames];
  const messageIndex = next.findIndex(isMessageNode);

  if (!message) {
    if (messageIndex !== -1) {
      next.splice(messageIndex, 1);
    }
  } else if (messageIndex === -1) {
    next.push(message);
  } else {
    next[messageIndex] = message;
  }

  return next.length > 0 ? next : undefined;
}

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

  const paramsSchema = createRecipeParametersSchema(recipe?.parameters ?? []);

  const formSchema = z.object({
    name: slotNameSchema.refine((name) => name === slot.name || !(name in slotsDraft), {
      message: "Another content block already uses this ID",
    }),
    priority: slotPrioritySchema,
    budget: slotBudgetSchema.nullable().transform((value) => value ?? null),
    params: paramsSchema,
    omitIfEmpty: z.boolean(),
    headerContent: z.string().optional(),
    headerRole: z.enum(["system", "user", "assistant"]),
    footerContent: z.string().optional(),
    footerRole: z.enum(["system", "user", "assistant"]),
    customSpec: jsonText(slotSpecSchema),
  });

  const defaultValues = {
    name: node.name || "",
    priority: slot.priority,
    budget: slot.budget,
    params: slot.params,
    omitIfEmpty: node.omitIfEmpty ?? true,
    headerContent: firstMessageNode(node.header)?.content || "",
    headerRole: firstMessageNode(node.header)?.role ?? "user",
    footerContent: firstMessageNode(node.footer)?.content || "",
    footerRole: firstMessageNode(node.footer)?.role ?? "user",
    customSpec: slot.customSpec ?? "{}",
  } satisfies SlotEditFormValues;

  const form = useAppForm({
    formId: `slot-edit-form-${node.id}`,
    defaultValues,
    validators: {
      onChange: ({ value }) => {
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
      const headerMessage = value.headerContent
        ? ({ role: value.headerRole, content: value.headerContent } satisfies MessageBlockDraft)
        : undefined;
      const footerMessage = value.footerContent
        ? ({ role: value.footerRole, content: value.footerContent } satisfies MessageBlockDraft)
        : undefined;

      const updatedNode: SlotLayoutDraft = {
        ...node,
        name: value.name,
        omitIfEmpty: value.omitIfEmpty,
        header: updateFrameCollection(node.header, headerMessage),
        footer: updateFrameCollection(node.footer, footerMessage),
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
      headerContent: firstMessageNode(node.header)?.content || "",
      headerRole: firstMessageNode(node.header)?.role ?? "user",
      footerContent: firstMessageNode(node.footer)?.content || "",
      footerRole: firstMessageNode(node.footer)?.role ?? "user",
      customSpec: slot.customSpec ?? "{}",
    } satisfies SlotEditFormValues);
  }, [form, node, slot]);

  const canSubmit = useStore(form.store, (state) => state.canSubmit);
  const hasRecipeParams = recipe && recipe.parameters.length > 0;

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
              disabled={!canSubmit}
            >
              <LuCheck />
            </IconButton>
            <IconButton size="xs" variant="ghost" onClick={onCancel} aria-label="Cancel edit">
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

          <Stack gap={3} direction={{ base: "column", md: "row" }}>
            <form.AppField name="name">
              {(field) => (
                <field.TextInput
                  label="Content Block ID"
                  helperText="Unique ID within this template"
                  required
                  fieldProps={{ flex: 3 }}
                />
              )}
            </form.AppField>

            <form.AppField name="priority">
              {(field) => (
                <field.NumberInput
                  label="Priority"
                  helperText="Higher priority blocks render first when budgets are tight"
                  required
                  min={0}
                  max={100}
                  fieldProps={{ flex: 1 }}
                />
              )}
            </form.AppField>

            <form.AppField name="budget">
              {(field) => (
                <field.NumberInput
                  label="Token Budget"
                  helperText="Leave blank to allow automatic budgeting"
                  fieldProps={{ flex: 1 }}
                  placeholder="Automatic"
                  allowEmpty
                  min={50}
                />
              )}
            </form.AppField>
          </Stack>

          <Accordion.Root collapsible defaultValue={["recipe-params"]} width="full">
            {hasRecipeParams && (
              <Accordion.Item value="recipe-params">
                <Accordion.ItemTrigger>
                  <Span flex="1">Block Configuration</Span>
                  <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                  <Accordion.ItemBody px={0}>
                    <VStack align="stretch" gap={3} width="full">
                      <ParamInputGroup
                        form={form}
                        fields={{ items: "params" }}
                        specs={recipe.parameters}
                      />
                    </VStack>
                  </Accordion.ItemBody>
                </Accordion.ItemContent>
              </Accordion.Item>
            )}
            {!recipe && (
              <Accordion.Item value="custom-recipe">
                <Accordion.ItemTrigger>
                  <Span flex="1">Custom Recipe Specification</Span>
                  <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                  <Text fontSize="xs" color="content.muted">
                    This content block can't be configured with the UI because it uses a custom
                    specification. Provide the full content specification as JSON.
                  </Text>
                  <form.AppField name="customSpec">
                    {(field) => (
                      <field.JsonEditor
                        label="Content JSON"
                        helperText="Provide the full content specification as JSON."
                        formatOnBlur
                        schema={jsonSchema}
                      />
                    )}
                  </form.AppField>
                </Accordion.ItemContent>
              </Accordion.Item>
            )}
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
                          <field.TextareaInput
                            label="Header"
                            helperText="Text displayed before content"
                            placeholder="Optional header"
                            fieldProps={{ flex: 2 }}
                          />
                        )}
                      </form.AppField>
                      <form.AppField name="headerRole">
                        {(field) => (
                          <field.Select
                            label="Header Role"
                            options={MESSAGE_ROLE_SELECT_OPTIONS.slice()}
                            fieldProps={{ flex: 1 }}
                          />
                        )}
                      </form.AppField>
                    </Stack>

                    <Stack gap={3} direction={{ base: "column", lg: "row" }}>
                      <form.AppField name="footerContent">
                        {(field) => (
                          <field.TextareaInput
                            label="Footer"
                            helperText="Text displayed after content"
                            placeholder="Optional footer"
                            fieldProps={{ flex: 2 }}
                          />
                        )}
                      </form.AppField>
                      <form.AppField name="footerRole">
                        {(field) => (
                          <field.Select
                            label="Footer Role"
                            options={MESSAGE_ROLE_SELECT_OPTIONS.slice()}
                            fieldProps={{ flex: 1 }}
                          />
                        )}
                      </form.AppField>
                    </Stack>

                    <form.AppField name="omitIfEmpty">
                      {(field) => (
                        <field.Switch helperText="Skip the block entirely when it produces no content">
                          Skip block if empty
                        </field.Switch>
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
