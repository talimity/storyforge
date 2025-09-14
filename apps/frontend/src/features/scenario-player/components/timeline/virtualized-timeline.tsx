import { Box, Heading, Text } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/contracts";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef } from "react";
import { CharacterStarterSelector } from "@/features/scenario-player/components/timeline/character-starter-selector";
import { DraftTurn } from "@/features/scenario-player/components/timeline/draft-turn";
import { TurnDeleteDialog } from "@/features/scenario-player/components/timeline/turn-delete-dialog";
import { TurnItem } from "@/features/scenario-player/components/timeline/turn-item";
import { useTimelineAutoLoadMore } from "@/features/scenario-player/hooks/use-timeline-auto-load-more";
import { useTimelineFollowOutputMode } from "@/features/scenario-player/hooks/use-timeline-follow-output-mode";
import { useTimelineInitialScrollToBottom } from "@/features/scenario-player/hooks/use-timeline-initial-scroll-to-bottom";
import { useTimelineKeepBottomDistance } from "@/features/scenario-player/hooks/use-timeline-keep-bottom-distance";
import { useTurnActions } from "@/features/scenario-player/hooks/use-turn-actions";
import { TimelineScrollProvider } from "@/features/scenario-player/providers/timeline-scroll-provider";
import {
  selectCurrentRun,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";

interface TimelineProps {
  scenarioId: string;
  scenarioTitle: string;
  chapterTitle?: string;
  turns: TimelineTurn[];
  hasNextPage?: boolean;
  /** Whether we are still awaiting initial data **/
  isPending?: boolean;
  /** Whether we are currently fetching more data **/
  isFetching?: boolean;
  onLoadMore?: () => Promise<unknown>;
  onTurnDeleted?: () => void;
  onStarterSelect?: (characterId: string, message: string) => void;
}

export function VirtualizedTimeline(props: TimelineProps) {
  const {
    scenarioId,
    scenarioTitle,
    chapterTitle,
    turns,
    hasNextPage,
    isFetching,
    isPending,
    onLoadMore,
    onTurnDeleted,
    onStarterSelect,
  } = props;
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // delete/edit actions
  const {
    turnToDelete,
    showDeleteDialog,
    isDeleting,
    editingTurnId,
    isUpdating,
    handleDeleteTurn,
    handleConfirmDelete,
    setShowDeleteDialog,
    handleEditTurn,
    handleRetryTurn,
  } = useTurnActions({
    onTurnDeleted,
    onTurnUpdated: onTurnDeleted,
  });

  // If a run is diverging from the current branch at a specific turn,
  // temporarily hide everything *after* that turn so DraftTurn appears at the correct place.
  const run = useIntentRunsStore(selectCurrentRun);
  const cutoffId = run?.truncateAfterTurnId ?? null;
  const visibleTurns = useMemo(() => {
    if (!cutoffId) return turns;
    const idx = turns.findIndex((t) => t.id === cutoffId);
    return idx >= 0 ? turns.slice(0, idx + 1) : turns;
  }, [turns, cutoffId]);

  // set up react-virtual
  const includeEmptyState = !isPending && visibleTurns.length === 0;
  const virtualCount = 1 + (includeEmptyState ? 1 : visibleTurns.length) + 1; // header + (empty state or turn list) + footer
  const v = useVirtualizer({
    count: virtualCount,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => 400,
    overscan: 3,
    rangeExtractor: (range) => {
      const base = defaultRangeExtractor(range);
      if (!editingTurnId) return base;

      // include the editing turn in the virtual list to prevent losing state when scrolling
      const editIndex = visibleTurns.findIndex((t) => t.id === editingTurnId);
      if (editIndex === -1) return base;
      return [...new Set([...base, editIndex + 1])].sort((a, b) => a - b); // add 1 to account for header
    },
    getItemKey: useCallback(
      (i: number) => {
        if (i === 0) return "header";
        if (i === virtualCount - 1) return "footer";
        if (includeEmptyState && i === 1) return "empty";
        const turnIdx = i - 1 - (includeEmptyState ? 1 : 0);
        return visibleTurns[turnIdx].id;
      },
      [visibleTurns, virtualCount, includeEmptyState]
    ),
    onChange: (...args) => {
      handleChange(...args);
    },
  });
  const items = v.getVirtualItems();

  // set up scrolling and auto-load behaviors
  const { initialDataReceivedRef } = useTimelineInitialScrollToBottom({ virtualizer: v, turns });
  const { handleChange } = useTimelineKeepBottomDistance({ virtualizer: v, turns });
  const { shouldAutoFollow } = useTimelineFollowOutputMode({ virtualizer: v, scrollerRef });
  useTimelineAutoLoadMore({ initialDataReceivedRef, items, onLoadMore, hasNextPage });

  const scrollToEnd = useCallback(() => {
    v.scrollBy(Number.MAX_SAFE_INTEGER, { align: "end" });
  }, [v]);

  if (isPending) {
    return (
      <Box textAlign="center" py={8}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  return (
    <>
      <Box
        ref={scrollerRef}
        style={{ overflowY: "auto", contain: "true", height: "100%" }}
        data-testid="timeline-scroller"
      >
        <Box
          style={{
            height: `${v.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
          mx="auto"
          maxW="3xl"
          py={{ base: 4, md: 6 }}
          data-testid="timeline-virtual-list"
        >
          <TimelineScrollProvider value={{ scrollToEnd, shouldAutoFollow }}>
            {items.map((row) => {
              const isHeader = row.key === "header";
              const isFooter = row.key === "footer";
              const isEmpty = row.key === "empty";
              const rowIdx = row.index - 1 - (includeEmptyState ? 1 : 0);

              return (
                <Box
                  key={row.key}
                  data-index={row.index}
                  ref={v.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${row.start}px)`,
                  }}
                >
                  <Box px={2} pb={2}>
                    {isHeader ? (
                      <TimelineHeader
                        scenarioTitle={scenarioTitle}
                        chapterTitle={chapterTitle}
                        isFetching={isFetching}
                      />
                    ) : isEmpty ? (
                      <TimelineEmptyState
                        scenarioId={scenarioId}
                        onStarterSelect={onStarterSelect}
                        isPending={isPending}
                        turns={turns}
                      />
                    ) : isFooter ? (
                      <TimelineFooter />
                    ) : (
                      <TurnItem
                        turn={visibleTurns[rowIdx]}
                        onDelete={handleDeleteTurn}
                        onEdit={handleEditTurn}
                        onRetry={handleRetryTurn}
                        isUpdating={editingTurnId === row.key && isUpdating}
                      />
                    )}
                  </Box>
                </Box>
              );
            })}
          </TimelineScrollProvider>
        </Box>
      </Box>

      <TurnDeleteDialog
        isOpen={showDeleteDialog}
        onOpenChange={(d) => setShowDeleteDialog(d.open)}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={isDeleting}
        cascade={turnToDelete?.cascade}
      />
    </>
  );
}

function TimelineHeader({
  scenarioTitle,
  chapterTitle,
  isFetching,
}: Pick<TimelineProps, "scenarioTitle" | "chapterTitle" | "isFetching">) {
  return (
    <Box textAlign="center" py={8}>
      <Heading size="lg" mb={2}>
        {scenarioTitle}
      </Heading>
      <Text color="content.muted">{chapterTitle || "No chapters"}</Text>

      {isFetching && (
        <Box mt={4}>
          <Text fontSize="sm" color="content.muted">
            Loading earlier history...
          </Text>
        </Box>
      )}
    </Box>
  );
}

function TimelineEmptyState({
  scenarioId,
  onStarterSelect,
  isPending,
  turns,
}: Pick<TimelineProps, "scenarioId" | "onStarterSelect" | "isPending" | "turns">) {
  return (
    <Box px={2} pb={2}>
      <CharacterStarterSelector
        enabled={!isPending && turns.length === 0}
        scenarioId={scenarioId}
        onStarterSelect={(chId, msg) => onStarterSelect?.(chId, msg)}
      />
    </Box>
  );
}

function TimelineFooter() {
  return (
    <Box px={2} pb={2}>
      <DraftTurn />
    </Box>
  );
}
