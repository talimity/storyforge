import {
  Accordion,
  Badge,
  createListCollection,
  HStack,
  Icon,
  IconButton,
  Input,
  NumberInput,
  Separator,
  Span,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { slotSpecSchema } from "@storyforge/prompt-rendering";
import type React from "react";
import { forwardRef, useCallback, useMemo } from "react";
import { Controller, useController, useForm } from "react-hook-form";
import { LuCheck, LuX } from "react-icons/lu";
import { z } from "zod";
import {
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  Switch,
} from "@/components/ui/index";
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

type SlotEditFormValues = {
  name: string;
  priority: number;
  budget?: number;
  params: Record<string, unknown>;
  omitIfEmpty: boolean;
  headerContent?: string;
  headerRole: "system" | "user" | "assistant";
  footerContent?: string;
  footerRole: "system" | "user" | "assistant";
  customSpec?: string;
};

interface SlotReferenceEditProps {
  node: SlotLayoutDraft;
  slot: SlotDraft;
  isDragging?: boolean;
  onSave?: (node: SlotLayoutDraft, slot: SlotDraft) => void;
  onCancel?: () => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}

export const SlotReferenceEdit = forwardRef<HTMLDivElement, SlotReferenceEditProps>(
  (props, ref) => {
    const { node, slot, isDragging = false, onSave, onCancel, dragHandleProps, style } = props;
    const NodeIcon = getNodeIcon(node);

    // Get the recipe definition
    const recipe = slot.recipeId !== "custom" ? getRecipeById(slot.recipeId) : undefined;
    const slotsDraft = useTemplateBuilderStore((s) => s.slotsDraft);
    const currentName = slot.name;

    // Build memoized RHF zod resolver schemas
    const paramsSchema = useMemo(
      () => createRecipeParametersSchema(recipe?.parameters ?? []),
      [recipe]
    );
    const formSchema = useMemo(
      () =>
        z.object({
          name: slotNameSchema.refine((n) => n === currentName || !(n in slotsDraft), {
            message: "Another content block already uses this ID",
          }),
          priority: slotPrioritySchema,
          budget: slotBudgetSchema.optional().transform((v) => v ?? undefined),
          params: paramsSchema,
          omitIfEmpty: z.boolean(),
          headerContent: z.string().optional(),
          headerRole: z.enum(["system", "user", "assistant"]),
          footerContent: z.string().optional(),
          footerRole: z.enum(["system", "user", "assistant"]),
          customSpec: z
            .string()
            .optional()
            .superRefine((val, ctx) => {
              if (!val?.trim()) return;
              let obj: unknown;
              try {
                obj = JSON.parse(val);
              } catch {
                ctx.addIssue({ code: "custom", message: "Invalid JSON" });
                return;
              }
              const parsed = slotSpecSchema.safeParse(obj);
              if (!parsed.success) ctx.addIssue({ code: "custom", message: parsed.error.message });
            }),
        }),
      [currentName, slotsDraft, paramsSchema]
    );

    const {
      register,
      control,
      handleSubmit,
      setFocus,
      formState: { errors },
    } = useForm<SlotEditFormValues>({
      resolver: zodResolver(formSchema),
      mode: "onBlur",
      shouldUnregister: true,
      criteriaMode: "all",
      defaultValues: {
        // Layout node properties
        omitIfEmpty: node.omitIfEmpty ?? true,
        headerContent: node.header?.content || "",
        headerRole: node.header?.role || "user",
        footerContent: node.footer?.content || "",
        footerRole: node.footer?.role || "user",
        name: node.name || "",
        // Slot properties
        priority: slot.priority,
        budget: slot.budget,
        params: slot.params,
        // Custom slot properties
        customSpec: slot.customSpec || "{}",
      },
    });

    const saveCallback = useCallback(
      (v: SlotEditFormValues) => {
        // Create updated layout node
        const updatedNode: SlotLayoutDraft = {
          ...node,
          name: v.name,
          omitIfEmpty: v.omitIfEmpty,
          header: v.headerContent ? { role: v.headerRole, content: v.headerContent } : undefined,
          footer: v.footerContent ? { role: v.footerRole, content: v.footerContent } : undefined,
        };

        // Create updated slot
        const isCustomRecipe = (slot.recipeId ?? "custom") === "custom";
        const updatedSlot: SlotDraft = {
          recipeId: slot.recipeId,
          name: v.name,
          priority: v.priority,
          budget: v.budget,
          params: v.params,
          customSpec: isCustomRecipe && v.customSpec?.trim() ? v.customSpec : undefined,
        };

        onSave?.(updatedNode, updatedSlot);
      },
      [node, slot, onSave]
    );

    const availableVariables = useMemo(() => {
      return recipe?.availableVariables || [];
    }, [recipe]);

    return (
      <NodeFrame
        ref={ref}
        node={node}
        isDragging={isDragging}
        dragHandleProps={dragHandleProps}
        style={style}
      >
        <VStack align="stretch" gap={4}>
          {/* Header */}
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
                onClick={handleSubmit(saveCallback, () => {
                  // Focus a likely-invalid field to guide the user
                  try {
                    setFocus("name");
                  } catch {}
                })}
                aria-label="Save changes"
              >
                <LuCheck />
              </IconButton>
              <IconButton size="xs" variant="ghost" onClick={onCancel} aria-label="Cancel edit">
                <LuX />
              </IconButton>
            </HStack>
          </HStack>

          {/* Form Fields */}
          <VStack align="stretch" gap={4}>
            {recipe?.name && recipe?.description && (
              <Text fontSize="xs" color="content.muted">
                {recipe.name}: {recipe.description}
              </Text>
            )}

            {/* Common parameters */}
            <Stack gap={3} direction={{ base: "column", lg: "row" }}>
              <Field
                label="Template ID"
                required
                helperText="Unique ID within template (does not appear in prompt)"
                flex={1}
                errorText={errors.name?.message}
                invalid={!!errors.name}
              >
                <Input
                  {...register("name")}
                  placeholder="e.g., 'recent-turns'"
                  autoComplete="off"
                />
              </Field>

              {recipe && (
                <Field
                  label="Token Budget Priority"
                  helperText="Blocks with lower priority numbers consume tokens first"
                  flex={1}
                  errorText={errors.priority?.message}
                  invalid={!!errors.priority}
                >
                  <Controller
                    name="priority"
                    control={control}
                    render={({ field }) => (
                      <NumberInput.Root
                        value={field.value.toString()}
                        onValueChange={({ valueAsNumber }) => {
                          const n = Number.isFinite(valueAsNumber) ? valueAsNumber : 0;
                          field.onChange(n);
                        }}
                        min={0}
                        max={10}
                        width="full"
                      >
                        <NumberInput.Input />
                      </NumberInput.Root>
                    )}
                  />
                </Field>
              )}
              <Separator />
            </Stack>

            {/* Recipe Configuration */}
            {recipe && (
              <VStack align="stretch" gap={3}>
                {/* Recipe parameters */}
                {recipe.parameters.length > 0 && (
                  <Accordion.Root collapsible defaultValue={["recipe-params"]} width="full">
                    <Accordion.Item value="recipe-params">
                      <Accordion.ItemTrigger>
                        <Span flex="1">Block Configuration</Span>
                        <Accordion.ItemIndicator />
                      </Accordion.ItemTrigger>
                      <Accordion.ItemContent>
                        <Accordion.ItemBody px={0}>
                          <VStack align="stretch" gap={3} width="full">
                            {recipe.parameters.map((param) => (
                              <ParamField
                                key={param.key}
                                name={`params.${param.key}`}
                                param={param}
                                availableVariables={availableVariables}
                                control={control}
                              />
                            ))}
                          </VStack>
                        </Accordion.ItemBody>
                      </Accordion.ItemContent>
                    </Accordion.Item>
                  </Accordion.Root>
                )}
              </VStack>
            )}

            {!recipe && (
              <>
                <Text fontSize="xs" color="content.muted">
                  This content block does not use a predefined recipe. You can manually write the
                  slot definition below.
                </Text>

                <Field
                  label="Content JSON"
                  errorText={errors.customSpec?.message}
                  invalid={!!errors.customSpec}
                >
                  <Textarea
                    {...register("customSpec")}
                    rows={2}
                    autoresize
                    fontFamily="mono"
                    placeholder="Enter custom block JSON here"
                    // onChange={(e) => {
                    //   setValue("customSpec", e.target.value);
                    // }}
                  />
                </Field>
              </>
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
                        <Field label="Header" helperText="Text displayed before content" flex={2}>
                          <Input
                            {...register("headerContent")}
                            placeholder="e.g., 'Recent turns:'"
                          />
                        </Field>

                        <Field label="Header Role" flex={1}>
                          <RoleSelect name="headerRole" control={control} />
                        </Field>
                      </Stack>

                      <Stack gap={3} direction={{ base: "column", lg: "row" }}>
                        <Field label="Footer" helperText="Text displayed after content" flex={2}>
                          <Input {...register("footerContent")} placeholder="e.g., '---'" />
                        </Field>

                        <Field label="Footer Role" flex={1}>
                          <RoleSelect name="footerRole" control={control} />
                        </Field>
                      </Stack>

                      <Controller
                        name="omitIfEmpty"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            colorPalette="primary"
                            checked={!!field.value}
                            onCheckedChange={({ checked }) => {
                              field.onChange(checked);
                            }}
                          >
                            Skip header/footer if block has no content
                          </Switch>
                        )}
                      />
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
);

function ParamField(props: {
  name: string;
  param: RecipeParamSpec;
  availableVariables: TemplateVariable[];
  // biome-ignore lint/suspicious/noExplicitAny: cannot infer crazy RHF generic
  control: any;
}) {
  const { name, param, availableVariables, control } = props;
  const { field, fieldState } = useController({ name, control });
  return (
    <ParameterInput
      param={param}
      value={field.value}
      onChange={field.onChange}
      availableVariables={availableVariables}
      isInvalid={!!fieldState.error}
      errorText={fieldState.error?.message}
    />
  );
}

function RoleSelect(props: {
  name: string;
  // biome-ignore lint/suspicious/noExplicitAny: idk
  control: any;
}) {
  const { name, control } = props;
  const { field } = useController({ name, control });
  return (
    <SelectRoot
      value={[field.value]}
      onValueChange={(details) => {
        field.onChange(details.value[0]);
      }}
      collection={createListCollection({ items: MESSAGE_ROLE_SELECT_OPTIONS })}
    >
      <SelectTrigger>
        <SelectValueText />
      </SelectTrigger>
      <SelectContent>
        {MESSAGE_ROLE_SELECT_OPTIONS.map((option) => (
          <SelectItem key={option.value} item={option}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}

SlotReferenceEdit.displayName = "SlotReferenceEdit";
