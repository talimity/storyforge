import {
  Accordion,
  Badge,
  HStack,
  Icon,
  IconButton,
  Input,
  NumberInput,
  Separator,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/prompt-renderer";
import { forwardRef, useCallback, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { LuCheck, LuX } from "react-icons/lu";
import { Field, Switch } from "@/components/ui";
import { getRecipeById } from "../../../recipes/registry";
import type { SlotDraft, SlotLayoutDraft } from "../../../types";
import { getNodeColor, getNodeIcon } from "../../builder-utils";
import { ParameterInput } from "../../parameter-inputs";
import { NodeFrame } from "../node-frame";

interface SlotReferenceEditProps {
  node: SlotLayoutDraft;
  slot?: SlotDraft;
  task?: TaskKind;
  isSelected?: boolean;
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
      task,
      isSelected = false,
      isDragging = false,
      onSave,
      onCancel,
      dragHandleProps,
      style,
    },
    ref
  ) => {
    const { borderColor } = getNodeColor(node);
    const NodeIcon = getNodeIcon(node);

    // Get the recipe definition
    const recipe =
      slot && slot.recipeId !== "custom"
        ? getRecipeById(slot.recipeId)
        : undefined;

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
        // Slot properties
        priority: slot?.priority ?? 0,
        budget: slot?.budget,
        params: slot?.params || {},
      },
    });

    const formData = watch();

    const handleSave = useCallback(() => {
      const values = getValues();

      // Create updated node
      const updatedNode: SlotLayoutDraft = {
        ...node,
        omitIfEmpty: values.omitIfEmpty,
        header: values.headerContent
          ? { role: "user" as const, content: values.headerContent }
          : undefined,
        footer: values.footerContent
          ? { role: "user" as const, content: values.footerContent }
          : undefined,
      };

      // Create updated slot
      const updatedSlot: SlotDraft = {
        recipeId: slot?.recipeId ?? "custom",
        name: node.name,
        priority: values.priority,
        budget: values.budget,
        params: values.params,
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
        isSelected={isSelected}
        isDragging={isDragging}
        dragHandleProps={dragHandleProps}
        style={style}
      >
        <VStack align="stretch" gap={4}>
          {/* Header */}
          <HStack gap={2} align="center">
            <Icon as={NodeIcon} color={borderColor} />
            <Badge size="sm" colorPalette="accent">
              Dynamic Content
            </Badge>
            <Text fontSize="sm" fontWeight="medium" flex={1}>
              Editing: {node.name}
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
            {/* Slot Configuration */}
            {recipe && (
              <VStack align="stretch" gap={3}>
                <Text fontSize="sm" fontWeight="medium">
                  Content Type: {recipe.name}
                </Text>
                {recipe.description && (
                  <Text fontSize="xs" color="content.muted">
                    {recipe.description}
                  </Text>
                )}

                <Field label="Priority" helperText="Lower numbers fill first">
                  <NumberInput.Root
                    value={formData.priority.toString()}
                    onValueChange={(details) => {
                      setValue("priority", Number(details.value));
                    }}
                    min={0}
                    max={10}
                  >
                    <NumberInput.Input />
                  </NumberInput.Root>
                </Field>

                {/* Recipe Parameters */}
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
            )}

            <Separator />

            {/* Reference Configuration */}
            <Field
              label="Hide When Empty"
              helperText="If enabled, this content and its headers/footers will be omitted when empty"
            >
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
                  />
                )}
              />
            </Field>

            <Accordion.Root collapsible>
              <Accordion.Item value="headers-footers">
                <Accordion.ItemTrigger>Headers & Footers</Accordion.ItemTrigger>
                <Accordion.ItemContent>
                  <Accordion.ItemBody>
                    <Stack gap={4}>
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
                    </Stack>
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
