import { Box, Center, Text, useBreakpointValue } from "@chakra-ui/react";
import type { TimelineGraphOutput } from "@storyforge/contracts";
import ELK from "elkjs/lib/elk.bundled.js";
import { useEffect, useState } from "react";
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

type GraphNode = TimelineGraphOutput["nodes"][number];
type GraphEdge = TimelineGraphOutput["edges"][number];

/**
 * Derives the set of edge ids that belong to the active timeline path.
 * ReactFlow edges are keyed as `${source}-${target}` so we follow that format.
 */
function buildActivePathEdgeIds(pathToAnchor: readonly string[]): Set<string> {
  const ids = new Set<string>();
  for (let index = 0; index < pathToAnchor.length - 1; index += 1) {
    const source = pathToAnchor[index];
    const target = pathToAnchor[index + 1];
    ids.add(`${source}-${target}`);
  }
  return ids;
}

/**
 * Maps raw graph nodes from the API into ReactFlow nodes. ReactFlow expects
 * every node to carry size and rendering metadata in addition to id/position.
 */
function buildTurnNodes(
  nodes: readonly GraphNode[],
  getParticipantLabel: (participantId: string) => string,
  getParticipantColor: (participantId: string) => string,
  formatTimestamp: (date: Date) => string,
  nodeWidth: number,
  nodeHeight: number
): Node<TurnNodeData>[] {
  return nodes.map<Node<TurnNodeData>>((node) => {
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
}

/**
 * Translates timeline edges into ReactFlow edges while decorating the active
 * path with accent styling. Handles collapsed-branch labels and ensures
 * siblings are ordered consistently.
 */
function buildEdges(
  edges: readonly GraphEdge[],
  nodes: readonly GraphNode[],
  activePathEdgeIds: Set<string>
): Edge[] {
  const collapsedCounts = new Map(nodes.map((node) => [node.id, node.collapsedLeafChildCount]));

  const grouped = new Map<string, { target: string; order: string }[]>();
  for (const edge of edges) {
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
      const edgeId = `${source}-${target}`;
      const onActivePath = activePathEdgeIds.has(edgeId);
      out.push({
        id: edgeId,
        source,
        target,
        type: "smoothstep",
        animated: false,
        style: {
          strokeWidth: onActivePath ? 2 : 1.5,
          stroke: onActivePath
            ? "var(--chakra-colors-accent-fg)"
            : "var(--chakra-colors-surface-border)",
        },
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
}

/**
 * Determines the preferred node to center when the canvas opens. Falling back
 * from anchor parent to root ensures a meaningful viewport even for tiny
 * graphs.
 */
function getDefaultFocusTurnId(
  pathToAnchor: readonly string[],
  rootTurnId: string | null,
  nodes: readonly GraphNode[]
): string | null {
  if (pathToAnchor.length >= 2) {
    return pathToAnchor[pathToAnchor.length - 2];
  }
  if (pathToAnchor.length === 1) {
    return pathToAnchor[0];
  }
  return rootTurnId ?? nodes[0]?.id ?? null;
}

/**
 * Picks the first focusable node from a list of candidates that actually exists
 * in the rendered graph. This guards against stale ids when the graph is
 * refreshed or the focus turn is no longer present.
 */
function resolveFocusTurnId(
  focusTurnId: string | undefined | null,
  defaultFocusTurnId: string | null,
  pathToAnchor: readonly string[],
  rootTurnId: string | null,
  nodes: readonly GraphNode[]
): string | undefined {
  const nodeIdSet = new Set(nodes.map((node) => node.id));
  const candidates = [
    focusTurnId,
    defaultFocusTurnId,
    pathToAnchor.at(-1),
    rootTurnId,
    nodes[0]?.id,
  ];
  for (const candidate of candidates) {
    if (candidate && nodeIdSet.has(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Visualizes a branching turn timeline inside ReactFlow with an auto-laid-out
 * layered tree. The component converts the API's timeline graph output into
 * ReactFlow nodes/edges, runs ELK for layout, and keeps the viewport centered
 * on the active branch.
 */
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

  const defaultFocusTurnId = getDefaultFocusTurnId(
    graph.pathToAnchor,
    graph.rootTurnId,
    graph.nodes
  );

  const resolvedFocusNodeId = resolveFocusTurnId(
    focusTurnId,
    defaultFocusTurnId,
    graph.pathToAnchor,
    graph.rootTurnId,
    graph.nodes
  );

  useEffect(() => {
    // Whenever the graph API data updates, rebuild nodes/edges and recompute their layout via ELK.
    // This effect runs async because ELK layout can be expensive and returns a promise.
    if (graph.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const activePathEdgeIds = buildActivePathEdgeIds(graph.pathToAnchor);
      const rawNodes = buildTurnNodes(
        graph.nodes,
        getParticipantLabel,
        getParticipantColor,
        formatTimestamp,
        nodeWidth,
        nodeHeight
      );
      const rawEdges = buildEdges(graph.edges, graph.nodes, activePathEdgeIds);

      const layout = await elk.layout({
        id: "root",
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.direction": "DOWN",
          "elk.layered.spacing.nodeNode": "48",
          "elk.layered.spacing.nodeNodeBetweenLayers": "64",
          "elk.spacing.nodeNode": "48",
        },
        children: rawNodes.map((node) => ({
          id: node.id,
          width: node.width ?? nodeWidth,
          height: node.height ?? nodeHeight,
        })),
        edges: rawEdges.map((edge) => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
      });

      if (cancelled) return;

      // Map the computed layout positions back onto the ReactFlow nodes.
      const positions: Record<string, XYPosition> = {};
      for (const child of layout.children ?? []) {
        positions[child.id] = {
          x: child.x ?? 0,
          y: child.y ?? 0,
        };
      }

      setEdges(rawEdges);
      setNodes((existing) =>
        rawNodes.map((node) => {
          // Preserve existing positions if ELK didn't return one for a node.
          const position = positions[node.id];
          if (position) {
            return { ...node, position };
          }
          const previous = existing.find((item) => item.id === node.id);
          if (previous) {
            return { ...node, position: previous.position };
          }
          return node;
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [
    graph.nodes,
    graph.edges,
    graph.pathToAnchor,
    getParticipantLabel,
    getParticipantColor,
    formatTimestamp,
    nodeWidth,
    nodeHeight,
  ]);

  useEffect(() => {
    // Give ReactFlow two paint frames to process the new node positions before
    // centering. The double rAF avoids a race where ReactFlow resets the
    // viewport after we set it.
    if (!instance) {
      return;
    }
    if (nodes.length === 0) {
      return;
    }

    const focusId = resolvedFocusNodeId;
    const positions = new Map(nodes.map((node) => [node.id, node.position]));
    let secondFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (!instance) {
          return;
        }
        if (focusId) {
          const position = positions.get(focusId);
          if (position) {
            const centerX = position.x + nodeWidth / 2;
            const centerY = position.y + nodeHeight / 2;
            const zoom = isMobile ? 0.8 : 1.2;
            instance.setCenter(centerX, centerY, { zoom, duration: 600 });
            return;
          }
        }
        instance.fitView({ padding: 0.3, duration: 300 });
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) {
        cancelAnimationFrame(secondFrame);
      }
    };
  }, [instance, nodes, resolvedFocusNodeId, isMobile, nodeWidth, nodeHeight]);

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
        minZoom={0.2}
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
