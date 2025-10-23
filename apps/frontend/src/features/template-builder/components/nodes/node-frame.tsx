import { Box, Card, HStack, Icon, VStack } from "@chakra-ui/react";
import { LuGripVertical } from "react-icons/lu";
import type { LayoutNodeDraft } from "@/features/template-builder/types";

interface NodeFrameProps {
  node: LayoutNodeDraft;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
  children: React.ReactNode;
  containerRef?: React.Ref<HTMLDivElement>;
}

export const NodeFrame = (props: NodeFrameProps) => {
  const { isDragging = false, dragHandleProps, style, children, containerRef } = props;
  return (
    <Card.Root
      ref={containerRef}
      style={style}
      layerStyle="surface"
      borderLeft="4px solid"
      borderLeftColor="border"
      bg="surface"
      opacity={isDragging ? 0.5 : 1}
      transition="all 0.2s"
      overflow="hidden"
      _hover={{ borderLeftColor: `border.700`, shadow: "md" }}
    >
      <HStack gap={0} align="stretch" h="full">
        {/* Full-height draggable area */}
        <Box
          {...dragHandleProps}
          position="relative"
          cursor="grab"
          _active={{ cursor: "grabbing" }}
          bg="surface.muted"
          px={2}
          py={3}
          minH="full"
          display="flex"
          alignItems="center"
          justifyContent="center"
          transition="all 0.2s"
          userSelect="none"
          touchAction="none"
          _hover={{ bg: "surface.emphasized" }}
          aria-label="Drag to reorder"
        >
          <VStack gap={1}>
            <Icon as={LuGripVertical} color="content.muted" />
          </VStack>
        </Box>

        {/* Content area */}
        <Box flex={1} p={3}>
          {children}
        </Box>
      </HStack>
    </Card.Root>
  );
};

NodeFrame.displayName = "NodeFrame";
