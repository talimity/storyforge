import { Badge, Box, Flex, HStack, Icon, IconButton, Span, Text, VStack } from "@chakra-ui/react";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import { NodeFrame } from "@/features/template-builder/components/nodes/node-frame";
import { getNodeIcon } from "@/features/template-builder/services/builder-utils";
import type { SlotDraft, SlotLayoutDraft } from "@/features/template-builder/types";

interface SlotReferenceViewProps {
  node: SlotLayoutDraft;
  slot?: SlotDraft;
  isDragging?: boolean;
  onEdit?: (node: SlotLayoutDraft) => void;
  onDelete?: (nodeId: string) => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
  containerRef?: React.Ref<HTMLDivElement>;
}

export const SlotReferenceView = (props: SlotReferenceViewProps) => {
  const {
    node,
    slot,
    isDragging = false,
    onEdit,
    onDelete,
    dragHandleProps,
    style,
    containerRef,
  } = props;
  const NodeIcon = getNodeIcon(node);
  if (!slot) {
    return <Text color="fg.error">Cannot resolve slot reference from node ID: {node.id}</Text>;
  }

  return (
    <NodeFrame
      containerRef={containerRef}
      node={node}
      isDragging={isDragging}
      dragHandleProps={dragHandleProps}
      style={style}
    >
      <VStack align="start" gap={2}>
        <HStack gap={2} align="center" w="full">
          <Icon as={NodeIcon} />

          {/* Node Type Badge */}
          <Badge size="sm">Content Block</Badge>

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
              aria-label="Edit block"
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
                aria-label="Delete block"
              >
                <LuTrash2 />
              </IconButton>
            )}
          </HStack>
        </HStack>

        {/* Slot Info */}
        <Box fontSize="xs" color="content.muted">
          <Flex gap="2">
            <Span>Block Type: {slot.recipeId}</Span>
            <Span>•</Span>
            <Span>Budget Priority: {slot.priority}</Span>
            {slot.budget && (
              <>
                <Span>•</Span>
                <Span>Budget: {slot.budget} tokens</Span>
              </>
            )}
          </Flex>
        </Box>

        {/* Reference-specific info */}
        <HStack gap={2} fontSize="xs" color="content.subtle">
          {node.header && <Text>Has header</Text>}
          {node.footer && <Text>Has footer</Text>}
          {node.omitIfEmpty && <Text>Hidden when empty</Text>}
        </HStack>
      </VStack>
    </NodeFrame>
  );
};

SlotReferenceView.displayName = "SlotReferenceView";
