import { Box, Flex, HStack, IconButton, Spinner, Text, useBreakpointValue } from "@chakra-ui/react";
import type { TimelineGraphOutput } from "@storyforge/contracts";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { LuMinimize } from "react-icons/lu";
import { Alert, Dialog } from "@/components/ui";
import { useTRPC } from "@/lib/trpc";
import { useBranchPreview } from "../hooks/use-branch-preview";
import { useScenarioContext } from "../providers/scenario-provider";
import { useScenarioPlayerStore } from "../stores/scenario-player-store";
import type { TurnNodeData } from "./turn-node";

const TurnGraphCanvas = lazy(() => import("./turn-graph-canvas"));

export interface TurnGraphDialogProps {
  scenarioId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const FALLBACK_COLOR = "#6b7280";

export function TurnGraphDialog({ scenarioId, isOpen, onOpenChange }: TurnGraphDialogProps) {
  const trpc = useTRPC();
  const { participantsById, getCharacterByParticipantId } = useScenarioContext();
  const previewLeafTurnId = useScenarioPlayerStore((s) => s.previewLeafTurnId);
  const lastVisibleTurnId = useScenarioPlayerStore((s) => s.lastVisibleTurnId);
  const setPendingScrollTarget = useScenarioPlayerStore((s) => s.setPendingScrollTarget);
  const { previewTurn, exitPreview } = useBranchPreview();
  const isMobile = useBreakpointValue({ base: true, md: false });

  const preferredFocusTurnId = previewLeafTurnId ?? lastVisibleTurnId ?? undefined;
  const [focusTurnIdParam, setFocusTurnIdParam] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen && focusTurnIdParam !== preferredFocusTurnId) {
      setFocusTurnIdParam(preferredFocusTurnId);
    }
  }, [isOpen, preferredFocusTurnId, focusTurnIdParam]);

  const graphQuery = useQuery({
    enabled: isOpen,
    ...trpc.timeline.graph.queryOptions(
      { scenarioId, focusTurnId: focusTurnIdParam },
      { staleTime: 30_000 }
    ),
  });

  const [lastData, setLastData] = useState<TimelineGraphOutput | null>(null);

  useEffect(() => {
    if (graphQuery.data) {
      setLastData(graphQuery.data);
    }
  }, [graphQuery.data]);

  const graphData = graphQuery.data ?? lastData;

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }),
    []
  );

  const formatTimestamp = useCallback((date: Date) => formatter.format(date), [formatter]);

  const getParticipantLabel = useCallback(
    (participantId: string) => {
      const participant = participantsById[participantId];
      if (!participant) return "Unknown participant";
      if (participant.type === "narrator") return "Narrator";
      const character = getCharacterByParticipantId(participantId);
      return character?.name ?? "Unknown character";
    },
    [getCharacterByParticipantId, participantsById]
  );

  const getParticipantColor = useCallback(
    (participantId: string) => {
      const participant = participantsById[participantId];
      if (!participant) return FALLBACK_COLOR;
      return participant.color ?? FALLBACK_COLOR;
    },
    [participantsById]
  );

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={({ open }) => onOpenChange(open)}
      scrollBehavior="inside"
      size={isMobile ? "full" : "cover"}
    >
      <Dialog.Content display="flex" flexDirection="column" maxW="100dvw" h="100dvh">
        <Dialog.Header justifyContent="space-between" alignItems="center">
          <Dialog.Title>Scenario Graph</Dialog.Title>
          <HStack gap="2" align="center">
            <IconButton
              aria-label="Refresh graph"
              variant="ghost"
              size="sm"
              onClick={() => graphQuery.refetch()}
              disabled={graphQuery.isFetching}
            >
              <LuMinimize />
            </IconButton>
            <Dialog.CloseTrigger position="static" />
          </HStack>
        </Dialog.Header>

        <Dialog.Body flex="1" display="flex" flexDirection="column" gap="4" pb="6">
          <Text fontSize="sm" color="content.muted">
            Explore the turns and branches of the scenario. Click on a turn or branch to focus on
            it.
          </Text>
          <Box flex="1" minH="0">
            {!isOpen ? null : graphQuery.isPending && !lastData ? (
              <Flex h="full" align="center" justify="center">
                <Spinner size="lg" />
              </Flex>
            ) : graphQuery.isError && !lastData ? (
              <Alert status="error" title="Failed to load graph">
                {graphQuery.error instanceof Error ? graphQuery.error.message : "Unexpected error"}
              </Alert>
            ) : graphData ? (
              <Suspense
                fallback={
                  <Flex h="full" align="center" justify="center">
                    <Spinner size="lg" />
                  </Flex>
                }
              >
                <TurnGraphCanvas
                  graph={graphData}
                  getParticipantLabel={getParticipantLabel}
                  getParticipantColor={getParticipantColor}
                  formatTimestamp={formatTimestamp}
                  focusTurnId={preferredFocusTurnId}
                  onNodeClick={async (turnId, data: TurnNodeData) => {
                    setPendingScrollTarget({
                      kind: "turn",
                      turnId,
                      edge: "center",
                      skipIfVisible: true,
                    });
                    if (data.onActivePath) {
                      exitPreview();
                    } else {
                      await previewTurn(turnId);
                    }
                  }}
                />
              </Suspense>
            ) : (
              <Flex h="full" align="center" justify="center">
                <Spinner size="lg" />
              </Flex>
            )}
          </Box>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  );
}
