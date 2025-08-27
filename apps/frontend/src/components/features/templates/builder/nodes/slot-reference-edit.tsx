import {
  Accordion,
  Badge,
  HStack,
  Icon,
  IconButton,
  Input,
  NumberInput,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { forwardRef, useCallback, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { LuCheck, LuX } from "react-icons/lu";
import {
  getNodeIcon,
  ParameterInput,
} from "@/components/features/templates/builder/index";
import { NodeFrame } from "@/components/features/templates/builder/nodes/node-frame";
import { getRecipeById } from "@/components/features/templates/recipes/registry";
import type {
  SlotDraft,
  SlotLayoutDraft,
} from "@/components/features/templates/types";
import { Field, Switch } from "@/components/ui";

interface SlotReferenceEditProps {
  node: SlotLayoutDraft;
  slot: SlotDraft;
  isDragging?: boolean;
  onSave?: (node: SlotLayoutDraft, slot: SlotDraft) => void;
  onCancel?: () => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}

export const SlotReferenceEdit = forwardRef<
  HTMLDivElement,
  SlotReferenceEditProps
>(
  (
    {
      node,
      slot,
      isDragging = false,
      onSave,
      onCancel,
      dragHandleProps,
      style,
    },
    ref
  ) => {
    const NodeIcon = getNodeIcon(node);

    // Get the recipe definition
    const recipe =
      slot.recipeId !== "custom" ? getRecipeById(slot.recipeId) : undefined;

    const { register, control, setValue, getValues, watch } = useForm({
      defaultValues: {
        // Slot reference properties
        omitIfEmpty: node.omitIfEmpty ?? true,
        headerContent:
          typeof node.header === "object" && !Array.isArray(node.header)
            ? node.header.content || ""
            : "",
        footerContent:
          typeof node.footer === "object" && !Array.isArray(node.footer)
            ? node.footer.content || ""
            : "",
        name: node.name || "",
        // Slot properties
        priority: slot.priority,
        budget: slot.budget,
        params: slot.params,
        // Custom properties
        customSpec: slot.customSpec || "{}",
      },
    });

    const formData = watch();

    const handleSave = useCallback(() => {
      const values = getValues();

      // Create updated node
      const updatedNode: SlotLayoutDraft = {
        ...node,
        name: values.name,
        omitIfEmpty: values.omitIfEmpty,
        header: values.headerContent
          ? { role: "user" as const, content: values.headerContent }
          : undefined,
        footer: values.footerContent
          ? { role: "user" as const, content: values.footerContent }
          : undefined,
      };

      // Create updated slot
      const isCustomRecipe = (slot.recipeId ?? "custom") === "custom";
      const updatedSlot: SlotDraft = {
        recipeId: isCustomRecipe ? "custom" : slot.recipeId,
        name: values.name,
        priority: values.priority,
        budget: values.budget,
        params: values.params,
        customSpec:
          isCustomRecipe && values.customSpec?.trim()
            ? values.customSpec
            : undefined,
      };

      onSave?.(updatedNode, updatedSlot);
    }, [node, slot, onSave, getValues]);

    const handleOmitIfEmptyChange = useCallback(
      (checked: boolean) => {
        setValue("omitIfEmpty", checked);
      },
      [setValue]
    );

    const handleParameterChange = useCallback(
      (paramKey: string, value: unknown) => {
        setValue(`params.${paramKey}`, value);
      },
      [setValue]
    );

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        handleSave();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onCancel?.();
      }
    };

    // Available variables for template strings
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
            <Badge size="sm">Content Slot</Badge>
            <Text fontSize="sm" fontWeight="medium" flex={1}>
              Editing '{node.name}'
            </Text>
            <HStack gap={1}>
              <IconButton
                size="xs"
                colorPalette="green"
                onClick={handleSave}
                aria-label="Save changes"
              >
                <LuCheck />
              </IconButton>
              <IconButton
                size="xs"
                variant="ghost"
                onClick={onCancel}
                aria-label="Cancel edit"
              >
                <LuX />
              </IconButton>
            </HStack>
          </HStack>

          {/* Form Fields */}
          <VStack align="stretch" gap={4}>
            {recipe?.name && recipe?.description && (
              <Text fontSize="xs" color="content.muted">
                '{recipe.name}' content slot. {recipe.description}
              </Text>
            )}

            {/* Common parameters */}
            <Stack gap={3} direction={{ base: "column", lg: "row" }}>
              <Field
                label="Template ID"
                required
                helperText="Unique ID within template (does not appear in prompt)"
                flex={1}
              >
                <Input
                  {...register("name")}
                  placeholder="e.g., 'recent-turns'"
                  autoComplete="off"
                  onChange={(e) => {
                    setValue("name", e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                />
              </Field>

              {recipe && (
                <Field
                  label="Budget Priority"
                  helperText="Lower numbers take from token budget first"
                  flex={1}
                >
                  <NumberInput.Root
                    value={formData.priority.toString()}
                    onValueChange={(details) => {
                      setValue("priority", Number(details.value));
                    }}
                    min={0}
                    max={10}
                    width="full"
                  >
                    <NumberInput.Input />
                  </NumberInput.Root>
                </Field>
              )}
            </Stack>

            {/* Recipe Configuration */}
            {recipe && (
              <VStack align="stretch" gap={3}>
                {/* Recipe parameters */}
                {recipe.parameters.length > 0 && (
                  <Accordion.Root
                    collapsible
                    defaultValue={["recipe-params"]}
                    width="full"
                  >
                    <Accordion.Item value="recipe-params">
                      <Accordion.ItemTrigger>
                        Content Parameters
                      </Accordion.ItemTrigger>
                      <Accordion.ItemContent>
                        <Accordion.ItemBody px={0}>
                          <VStack align="stretch" gap={3} width="full">
                            {recipe.parameters.map((param) => (
                              <ParameterInput
                                key={param.key}
                                param={param}
                                value={formData.params[param.key]}
                                onChange={(value) =>
                                  handleParameterChange(param.key, value)
                                }
                                availableVariables={availableVariables}
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
                  This content slot does not use a predefined recipe. You can
                  define custom parameters manually.
                </Text>

                <Field label="Content JSON">
                  <Textarea
                    {...register("customSpec", {
                      validate: (v) => {
                        if (!v?.trim()) return true;
                        try {
                          JSON.parse(v);
                          return true;
                        } catch {
                          return "Invalid JSON";
                        }
                      },
                    })}
                    rows={2}
                    autoresize
                    fontFamily="mono"
                    placeholder="Enter custom slot JSON here"
                    onChange={(e) => {
                      setValue("customSpec", e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                  />
                </Field>
              </>
            )}

            <Accordion.Root collapsible width="full">
              <Accordion.Item value="headers-footers">
                <Accordion.ItemTrigger>Headers & Footers</Accordion.ItemTrigger>
                <Accordion.ItemContent>
                  <Accordion.ItemBody px={0}>
                    <VStack align="stretch" gap={4} width="full">
                      <Field
                        label="Header"
                        helperText="Text displayed before content"
                      >
                        <Input
                          {...register("headerContent")}
                          placeholder="e.g., 'Recent turns:'"
                          onChange={(e) => {
                            setValue("headerContent", e.target.value);
                          }}
                          onKeyDown={handleKeyDown}
                        />
                      </Field>

                      <Field
                        label="Footer"
                        helperText="Text displayed after content"
                      >
                        <Input
                          {...register("footerContent")}
                          placeholder="e.g., '---'"
                          onChange={(e) => {
                            setValue("footerContent", e.target.value);
                          }}
                          onKeyDown={handleKeyDown}
                        />
                      </Field>

                      <Controller
                        name="omitIfEmpty"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            checked={field.value}
                            colorPalette="primary"
                            onCheckedChange={({ checked }) => {
                              field.onChange(checked);
                              handleOmitIfEmptyChange(checked);
                            }}
                          >
                            Skip header and footer if slot does not produce any
                            content
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

SlotReferenceEdit.displayName = "SlotReferenceEdit";
