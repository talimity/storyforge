import {
  Badge,
  HStack,
  Icon,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import { forwardRef } from "react";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import { getNodeIcon } from "@/components/features/templates/builder/index";
import { NodeFrame } from "@/components/features/templates/builder/nodes/node-frame";
import type {
  SlotDraft,
  SlotLayoutDraft,
} from "@/components/features/templates/types";

interface SlotReferenceViewProps {
  node: SlotLayoutDraft;
  slot?: SlotDraft;
  isDragging?: boolean;
  onEdit?: (node: SlotLayoutDraft) => void;
  onDelete?: (nodeId: string) => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}

export const SlotReferenceView = forwardRef<
  HTMLDivElement,
  SlotReferenceViewProps
>(
  (
    {
      node,
      slot,
      isDragging = false,
      onEdit,
      onDelete,
      dragHandleProps,
      style,
    },
    ref
  ) => {
    const NodeIcon = getNodeIcon(node);
    if (!slot) {
      return <Text color="red.500">Slot not found for ID: {node.id}</Text>;
    }

    return (
      <NodeFrame
        ref={ref}
        node={node}
        isDragging={isDragging}
        dragHandleProps={dragHandleProps}
        style={style}
      >
        <VStack align="start" gap={2}>
          <HStack gap={2} align="center" w="full">
            <Icon as={NodeIcon} />

            {/* Node Type Badge */}
            <Badge size="sm">Content Slot</Badge>

            {/* Node Name/Title */}
            <Text fontSize="sm" fontWeight="medium" flex={1}>
              {node.name}
            </Text>

            {/* Actions */}
            <HStack gap={1}>
              <IconButton
                size="xs"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(node);
                }}
                aria-label="Edit slot reference"
              >
                <LuPencil />
              </IconButton>
              {onDelete && (
                <IconButton
                  size="xs"
                  variant="ghost"
                  colorPalette="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(node.id);
                  }}
                  aria-label="Delete node"
                >
                  <LuTrash2 />
                </IconButton>
              )}
            </HStack>
          </HStack>

          {/* Slot Info */}
          <Text fontSize="xs" color="content.muted">
            Priority: {slot.priority} • Type: {slot.recipeId}
            {slot.budget && ` • Budget: ${slot.budget} tokens`}
          </Text>

          {/* Reference-specific info */}
          <HStack gap={2} fontSize="xs" color="content.subtle">
            {node.header && <Text>Has header</Text>}
            {node.footer && <Text>Has footer</Text>}
            {node.omitIfEmpty && <Text>Hidden when empty</Text>}
          </HStack>
        </VStack>
      </NodeFrame>
    );
  }
);

SlotReferenceView.displayName = "SlotReferenceView";
