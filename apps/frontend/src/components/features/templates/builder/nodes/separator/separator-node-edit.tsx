import {
  Badge,
  HStack,
  Icon,
  IconButton,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { forwardRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { LuCheck, LuX } from "react-icons/lu";
import { Field } from "@/components/ui";
import type { SeparatorLayoutDraft } from "../../../types";
import { getNodeColor, getNodeIcon } from "../../builder-utils";
import { NodeFrame } from "../node-frame";

interface SeparatorNodeEditProps {
  node: SeparatorLayoutDraft;
  isSelected?: boolean;
  isDragging?: boolean;
  onSave?: (node: SeparatorLayoutDraft) => void;
  onCancel?: () => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}

export const SeparatorNodeEdit = forwardRef<
  HTMLDivElement,
  SeparatorNodeEditProps
>(
  (
    {
      node,
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

    const { register, setValue, getValues } = useForm({
      defaultValues: {
        text: node.text || "",
      },
    });

    const handleSave = useCallback(() => {
      const values = getValues();
      const updatedNode: SeparatorLayoutDraft = {
        ...node,
        text: values.text || undefined,
      };
      onSave?.(updatedNode);
    }, [node, onSave, getValues]);

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        handleSave();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onCancel?.();
      }
    };

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
            <Badge size="sm" colorPalette="neutral">
              Separator
            </Badge>
            <Text fontSize="sm" fontWeight="medium" flex={1}>
              Editing Separator
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
            <Field
              label="Separator Text"
              helperText="Text to display as a separator between messages"
            >
              <Textarea
                {...register("text")}
                placeholder="e.g., ---, ===, or custom text"
                rows={2}
                fontFamily="mono"
                onChange={(e) => {
                  setValue("text", e.target.value);
                }}
                onKeyDown={handleKeyDown}
              />
            </Field>
          </VStack>
        </VStack>
      </NodeFrame>
    );
  }
);

SeparatorNodeEdit.displayName = "SeparatorNodeEdit";
