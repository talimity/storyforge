import { Badge, Box, HStack, Text } from "@chakra-ui/react";
import { Handle, type NodeProps, Position } from "reactflow";
import { Tooltip } from "@/components/ui";

export type TurnNodeData = {
  label: string;
  timestamp: string;
  color: string;
  collapsedLeafCount: number;
  onActivePath: boolean;
  isGhost: boolean;
  turnNumber: number;
};

const ACTIVE_BORDER_WIDTH = 2;
const DEFAULT_BORDER_WIDTH = 1;

export function TurnNode({ data, selected }: NodeProps<TurnNodeData>) {
  const highlighted = selected || data.onActivePath;
  const shadow = highlighted ? "subtle" : "inherit";
  const borderWidth = highlighted ? ACTIVE_BORDER_WIDTH : DEFAULT_BORDER_WIDTH;
  const borderColor = highlighted ? "accent.fg" : "inherit";
  const borderStyle = data.isGhost ? "dashed" : "solid";

  return (
    <Box
      role="group"
      w="240px"
      h="72px"
      px="3"
      py="2"
      rounded="md"
      layerStyle="surface"
      borderWidth={borderWidth}
      borderColor={borderColor}
      borderStyle={borderStyle}
      shadow={shadow}
      transition="box-shadow 0.15s ease, transform 0.15s ease"
      _hover={{ shadow: "medium", cursor: "pointer", transform: "translateY(-2px)" }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          pointerEvents: "none",
          background: "transparent",
        }}
      />
      <HStack justify="space-between" align="start" gap="2">
        <Box minW={0} flex="1">
          <Text
            lineClamp={2}
            fontSize="sm"
            fontWeight="semibold"
            layerStyle="tinted.normal"
            css={{ "--input-color": data.color }}
          >
            #{data.turnNumber} · {data.label}
          </Text>
          <Text mt="1" fontSize="xs" color="content.muted">
            {data.timestamp}
          </Text>
        </Box>
        {data.collapsedLeafCount > 0 ? (
          <Tooltip
            content={`${data.collapsedLeafCount} alternate${data.collapsedLeafCount === 1 ? "" : "s"} hidden`}
          >
            <Badge size="xs" colorPalette="neutral" rounded="sm" fontWeight="medium">
              +{data.collapsedLeafCount}
            </Badge>
          </Tooltip>
        ) : null}
      </HStack>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          pointerEvents: "none",
          background: "transparent",
        }}
      />
    </Box>
  );
}
