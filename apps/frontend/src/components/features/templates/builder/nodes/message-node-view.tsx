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
import {
  getNodeIcon,
  getRoleLabel,
} from "@/components/features/templates/builder/index";
import { NodeFrame } from "@/components/features/templates/builder/nodes/node-frame";
import type { MessageLayoutDraft } from "@/components/features/templates/types";

interface MessageNodeViewProps {
  node: MessageLayoutDraft;
  isDragging?: boolean;
  onEdit?: (node: MessageLayoutDraft) => void;
  onDelete?: (nodeId: string) => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}

export const MessageNodeView = forwardRef<HTMLDivElement, MessageNodeViewProps>(
  (
    { node, isDragging = false, onEdit, onDelete, dragHandleProps, style },
    ref
  ) => {
    const NodeIcon = getNodeIcon(node);
    const hasContent = node.content || node.from;

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
            <Badge size="sm">{getRoleLabel(node.role)}</Badge>

            {/* Node Name/Title */}
            <Text fontSize="sm" fontWeight="medium" flex={1}>
              {node.name || getRoleLabel(node.role)}
            </Text>

            {/* Actions */}
            <HStack gap={1}>
              {hasContent && (
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
              )}
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
              lineClamp={3}
              whiteSpace="pre-wrap"
              wordBreak="break-word"
            >
              {node.content || `Data from: ${node.from?.source}`}
            </Text>
          )}

          {/* Message-specific info */}
          {node.prefix && (
            <Badge size="xs" colorPalette="orange">
              Assistant Prefill
            </Badge>
          )}
        </VStack>
      </NodeFrame>
    );
  }
);

MessageNodeView.displayName = "MessageNodeView";
