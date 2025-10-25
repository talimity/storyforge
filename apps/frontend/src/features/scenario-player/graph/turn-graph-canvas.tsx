import { Box, Center, Text, useBreakpointValue } from "@chakra-ui/react";
import type { TimelineGraphOutput } from "@storyforge/contracts";
import ELK from "elkjs/lib/elk.bundled.js";
import { useEffect, useMemo, useState } from "react";
import type { Edge, Node, ReactFlowInstance, XYPosition } from "reactflow";
import { Background, Controls, ReactFlow } from "reactflow";
import { TurnNode, type TurnNodeData } from "./turn-node";

import "reactflow/dist/style.css";

const elk = new ELK();

// const NODE_WIDTH = 240;
// const NODE_HEIGHT = 72;

interface TurnGraphCanvasProps {
  graph: TimelineGraphOutput;
  getParticipantLabel: (participantId: string) => string;
  getParticipantColor: (participantId: string) => string;
  formatTimestamp: (date: Date) => string;
  focusTurnId?: string | null;
  onNodeClick?: (turnId: string, data: TurnNodeData) => void;
}

const nodeTypes = { turn: TurnNode } as const;

export default function TurnGraphCanvas({
  graph,
  getParticipantLabel,
  getParticipantColor,
  formatTimestamp,
  focusTurnId,
  onNodeClick,
}: TurnGraphCanvasProps) {
  const [nodes, setNodes] = useState<Node<TurnNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [instance, setInstance] = useState<ReactFlowInstance | null>(null);
  const isMobile = useBreakpointValue({ base: true, md: false });
  const nodeWidth = isMobile ? 200 : 240;
  const nodeHeight = isMobile ? 60 : 72;

  const collapsedCounts = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node.collapsedLeafChildCount])),
    [graph.nodes]
  );

  const baseNodes = useMemo(() => {
    return graph.nodes.map<Node<TurnNodeData>>((node) => {
      const label = getParticipantLabel(node.authorParticipantId);
      const color = getParticipantColor(node.authorParticipantId);
      return {
        id: node.id,
        type: "turn",
        position: { x: 0, y: 0 },
        data: {
          label,
          timestamp: formatTimestamp(node.createdAt),
          color,
          collapsedLeafCount: node.collapsedLeafChildCount,
          onActivePath: node.onActivePath,
          isGhost: node.isGhost,
          turnNumber: node.turnNumber,
        },
        width: nodeWidth,
        height: nodeHeight,
      };
    });
  }, [
    graph.nodes,
    getParticipantColor,
    getParticipantLabel,
    formatTimestamp,
    nodeWidth,
    nodeHeight,
  ]);

  const baseEdges = useMemo(() => {
    const grouped = new Map<string, { target: string; order: string }[]>();
    for (const edge of graph.edges) {
      const list = grouped.get(edge.source) ?? [];
      list.push({ target: edge.target, order: edge.order });
      grouped.set(edge.source, list);
    }

    const out: Edge[] = [];
    for (const [source, targets] of grouped.entries()) {
      targets.sort((a, b) => a.order.localeCompare(b.order));
      const hidden = collapsedCounts.get(source) ?? 0;
      targets.forEach(({ target }, index) => {
        const label = hidden > 0 && index === 0 ? `+${hidden} ` : undefined;
        out.push({
          id: `${source}-${target}`,
          source,
          target,
          type: "smoothstep",
          animated: false,
          style: { strokeWidth: 1.5 },
          ...(label
            ? {
                label,
                labelStyle: {
                  fill: "var(--chakra-colors-content-emphasized)",
                  fontSize: 14,
                  fontWeight: 400,
                },
                labelBgStyle: {
                  fill: "var(--chakra-colors-surface)",
                  stroke: "var(--chakra-colors-surface-border)",
                },
                labelBgPadding: [10, 2],
                labelBgBorderRadius: 4,
              }
            : {}),
        });
      });
    }

    return out;
  }, [graph.edges, collapsedCounts]);

  const nodeIdSet = useMemo(() => new Set(baseNodes.map((node) => node.id)), [baseNodes]);

  const defaultFocusTurnId = useMemo(() => {
    if (graph.pathToAnchor.length >= 2) {
      return graph.pathToAnchor[graph.pathToAnchor.length - 2];
    }
    if (graph.pathToAnchor.length === 1) {
      return graph.pathToAnchor[0];
    }
    return graph.rootTurnId ?? graph.nodes[0]?.id ?? null;
  }, [graph.pathToAnchor, graph.rootTurnId, graph.nodes]);

  const resolvedFocusNodeId = useMemo(() => {
    const candidates = [
      focusTurnId,
      defaultFocusTurnId,
      graph.pathToAnchor.at(-1),
      graph.rootTurnId,
    ];
    for (const candidate of candidates) {
      if (candidate && nodeIdSet.has(candidate)) {
        return candidate;
      }
    }
    const first = graph.nodes[0]?.id;
    return first && nodeIdSet.has(first) ? first : undefined;
  }, [
    focusTurnId,
    defaultFocusTurnId,
    graph.pathToAnchor,
    graph.rootTurnId,
    graph.nodes,
    nodeIdSet,
  ]);

  useEffect(() => {
    setEdges(baseEdges);
    setNodes(baseNodes);
  }, [baseEdges, baseNodes]);

  useEffect(() => {
    if (baseNodes.length === 0) {
      return;
    }

    let cancelled = false;
    (async () => {
      const layout = await elk.layout({
        id: "root",
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.direction": "DOWN",
          "elk.layered.spacing.nodeNode": "48",
          "elk.layered.spacing.nodeNodeBetweenLayers": "64",
          "elk.spacing.nodeNode": "48",
        },
        children: baseNodes.map((node) => ({
          id: node.id,
          width: node.width ?? nodeWidth,
          height: node.height ?? nodeHeight,
        })),
        edges: baseEdges.map((edge) => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
      });

      if (cancelled) return;

      const positions: Record<string, XYPosition> = {};
      for (const child of layout.children ?? []) {
        positions[child.id] = {
          x: child.x ?? 0,
          y: child.y ?? 0,
        };
      }

      setNodes((existing) =>
        existing.map((node) => ({
          ...node,
          position: positions[node.id] ?? node.position,
        }))
      );

      requestAnimationFrame(() => {
        if (cancelled || !instance) return;
        if (resolvedFocusNodeId && positions[resolvedFocusNodeId]) {
          const position = positions[resolvedFocusNodeId];
          const centerX = position.x + nodeWidth / 2;
          const centerY = position.y + nodeHeight / 2;
          const zoom = isMobile ? 0.8 : 1.2;
          instance.setCenter(centerX, centerY, { zoom, duration: 600 });
        } else {
          instance.fitView({ padding: 0.3, duration: 300 });
        }
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [baseNodes, baseEdges, instance, resolvedFocusNodeId, isMobile, nodeWidth, nodeHeight]);

  if (graph.nodes.length === 0) {
    return (
      <Center h="full">
        <Text fontSize="sm" color="content.muted">
          Nothing here yet.
        </Text>
      </Center>
    );
  }

  return (
    <Box h="full" w="full" borderRadius="md" overflow="hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        onInit={(inst) => setInstance(inst)}
        onNodeClick={(_, node) => {
          if (onNodeClick) {
            onNodeClick(node.id, node.data as TurnNodeData);
          }
        }}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={32} />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
    </Box>
  );
}
