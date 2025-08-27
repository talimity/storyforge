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
import type { SeparatorLayoutDraft } from "../../../types";
import { getNodeColor, getNodeIcon } from "../../builder-utils";
import { NodeFrame } from "../node-frame";

interface SeparatorNodeViewProps {
  node: SeparatorLayoutDraft;
  isSelected?: boolean;
  isDragging?: boolean;
  onEdit?: (node: SeparatorLayoutDraft) => void;
  onDelete?: (nodeId: string) => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}

export const SeparatorNodeView = forwardRef<
  HTMLDivElement,
  SeparatorNodeViewProps
>(
  (
    {
      node,
      isSelected = false,
      isDragging = false,
      onEdit,
      onDelete,
      dragHandleProps,
      style,
    },
    ref
  ) => {
    const { borderColor } = getNodeColor(node);
    const NodeIcon = getNodeIcon(node);
    const hasContent = !!node.text;

    return (
      <NodeFrame
        ref={ref}
        node={node}
        isSelected={isSelected}
        isDragging={isDragging}
        dragHandleProps={dragHandleProps}
        style={style}
      >
        <VStack align="start" gap={2}>
          <HStack gap={2} align="center" w="full">
            <Icon as={NodeIcon} color={borderColor} />

            {/* Node Type Badge */}
            <Badge size="sm" colorPalette="neutral">
              Separator
            </Badge>

            {/* Node Name/Title */}
            <Text fontSize="sm" fontWeight="medium" flex={1}>
              Separator
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
                aria-label="Edit content"
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

          {/* Content Display */}
          {hasContent && (
            <Text
              fontSize="sm"
              color="content.muted"
              w="full"
              lineClamp={2}
              wordBreak="break-word"
            >
              {node.text}
            </Text>
          )}
        </VStack>
      </NodeFrame>
    );
  }
);

SeparatorNodeView.displayName = "SeparatorNodeView";
