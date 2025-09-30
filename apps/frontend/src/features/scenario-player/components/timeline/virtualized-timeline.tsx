import { Box, Heading, Text, useBreakpointValue, useToken } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/contracts";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef } from "react";
import { ChapterSeparator } from "@/features/scenario-player/components/timeline/chapter-separator";
import { CharacterStarterSelector } from "@/features/scenario-player/components/timeline/character-starter-selector";
import { DraftTurn } from "@/features/scenario-player/components/timeline/draft-turn";
import { InsertTurnDialog } from "@/features/scenario-player/components/timeline/insert-turn-dialog";
import { RetryIntentDialog } from "@/features/scenario-player/components/timeline/retry-intent-dialog";
import { TimelineTurnRow } from "@/features/scenario-player/components/timeline/timeline-turn-row";
import { TurnDeleteDialog } from "@/features/scenario-player/components/timeline/turn-delete-dialog";
import { useTimelineAutoLoadMore } from "@/features/scenario-player/hooks/use-timeline-auto-load-more";
import { useTimelineFollowOutputMode } from "@/features/scenario-player/hooks/use-timeline-follow-output-mode";
import { useInitialScroll } from "@/features/scenario-player/hooks/use-timeline-initial-anchor";
import { useTimelineKeepBottomDistance } from "@/features/scenario-player/hooks/use-timeline-keep-bottom-distance";
import { useTimelineScrollController } from "@/features/scenario-player/hooks/use-timeline-scroll-controller";
import { useTurnActions } from "@/features/scenario-player/hooks/use-turn-actions";
import {
  selectCurrentRun,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";

const LIST_PADDING_Y_BREAKPOINTS = { base: 4, md: 6 };

interface TimelineProps {
  scenarioId: string;
  scenarioTitle: string;
  firstChapterLabel?: string;
  turns: TimelineTurn[];
  hasNextPage?: boolean;
  /** Whether we are still awaiting initial data **/
  isPending?: boolean;
  /** Whether we are currently fetching more data **/
  isFetching?: boolean;
  onLoadMore?: () => Promise<unknown>;
  onStarterSelect?: (characterId: string, message: string) => void;
}

export function VirtualizedTimeline(props: TimelineProps) {
  const {
    scenarioId,
    scenarioTitle,
    firstChapterLabel,
    turns,
    hasNextPage,
    isFetching,
    isPending,
    onLoadMore,
    onStarterSelect,
  } = props;
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const {
    turnToDelete,
    showDeleteDialog,
    isDeleting,
    retryTurn,
    isRetrying,
    editingTurnId,
    isUpdating,
    handleDeleteTurn,
    handleConfirmDelete,
    handleCancelDelete,
    handleEditTurn,
    handleRetryTurn,
    handleRetrySubmit,
    handleRetryClose,
    manualTurnTarget,
    isInsertingManualTurn,
    handleInsertManualTurn,
    handleManualInsertSubmit,
    handleManualInsertClose,
  } = useTurnActions();

  // If the active run is generating a new branch, we want to temporarily hide
  // all turns under the branching point, so that the DraftTurn (the list's
  // footer) appears in the spot where the new leaf would be.
  const run = useIntentRunsStore(selectCurrentRun);
  const cutoffId = run?.truncateAfterTurnId ?? null;
  const visibleTurns = useMemo(() => {
    if (!cutoffId) return turns;
    const idx = turns.findIndex((t) => t.id === cutoffId);
    return idx >= 0 ? turns.slice(0, idx + 1) : turns;
  }, [turns, cutoffId]);

  // Set up list virtualization
  const includeEmptyState = !isPending && visibleTurns.length === 0;
  const virtualCount = 1 + (includeEmptyState ? 1 : visibleTurns.length) + 1; // header + (empty state or turn list) + footer
  const v = useVirtualizer({
    count: virtualCount,
    getScrollElement: () => scrollerRef.current,
    // react-virtual docs advise erring on larger side for estimating dynamic
    // item sizes to avoid scroll jitter, because our infinite list grows
    // upwards instead of downwards (so the scrolling direction as we add new
    // items is inversed) the advice needs to be reversed as well. Failing to do
    // this causes Safari momentum scrolling to abruptly stop every time an
    // estimation is larger than a new virtualized row's real size.
    // https://github.com/TanStack/react-virtual/issues/884
    estimateSize: () => 50,
    scrollPaddingEnd: 80,
    paddingEnd: 80,
    overscan: 5,
    // rangeExtractor lets selectively disable virtualization for certain items.
    // we do this to avoid unmounting the turn being edited so we don't lose
    // unsaved changes.
    rangeExtractor: (range) => {
      const base = defaultRangeExtractor(range);
      if (!editingTurnId) return base;

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
  const totalSize = v.getTotalSize();
  const items = v.getVirtualItems();

  // Scroll to bottom after mounting and receiving initial data
  const { pendingInitialScroll } = useInitialScroll({ virtualizer: v, scrollerRef, turns });
  // Tuck all imperative scroll logic into a single controller
  useTimelineScrollController({
    virtualizer: v,
    scrollerRef,
    visibleTurns,
    hasNextPage,
    isFetching,
    onLoadMore,
  });
  // Monitor scroll position to keep relative position as new data is prepended
  const { handleChange } = useTimelineKeepBottomDistance({ virtualizer: v, turns });
  // Monitor scroll events to enable or disable auto-following during generations
  useTimelineFollowOutputMode({ virtualizer: v, scrollerRef });
  // Load new data when reaching the top of the list
  useTimelineAutoLoadMore({ pendingInitialScroll, items, isFetching, onLoadMore, hasNextPage });

  // micro-optimizations/placebos
  // Chakra <Box> components incur a couple ms of emotionjs overhead/bloat, so
  // we use divs bring react-virtual scroll rerenders down to the minimum. To
  // do that we need to pull the Chakra theme tokens to apply correct spacing.
  const pyKey = useBreakpointValue(LIST_PADDING_Y_BREAKPOINTS) ?? 0;
  const [py] = useToken("space", [String(pyKey)]);
  const [maxW] = useToken("sizes", ["3xl"]);
  const virtualListStyles = useMemo(
    () =>
      ({
        height: `${totalSize}px`,
        width: "100%",
        position: "relative" as const,
        paddingTop: py,
        paddingBottom: py,
        marginInline: "auto",
        maxWidth: maxW,
      }) as const,
    [totalSize, py, maxW]
  );

  if (isPending) {
    return (
      <Box textAlign="center" py={8}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  return (
    <>
      <div
        ref={scrollerRef}
        style={{ overflowY: "auto", contain: "content", height: "100%" }}
        data-testid="timeline-scroller"
      >
        <div style={virtualListStyles} data-testid="timeline-virtual-list">
          {items.map((row) => {
            const isHeader = row.key === "header";
            const isFooter = row.key === "footer";
            const isEmpty = row.key === "empty";
            const rowIdx = row.index - 1 - (includeEmptyState ? 1 : 0);

            return (
              <div
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
                {isHeader ? (
                  <TimelineHeader
                    scenarioTitle={scenarioTitle}
                    chapterLabel={firstChapterLabel}
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
                  <TimelineTurnRow
                    turn={visibleTurns[rowIdx]}
                    prevTurn={rowIdx > 0 ? visibleTurns[rowIdx - 1] : null}
                    nextTurn={rowIdx < visibleTurns.length - 1 ? visibleTurns[rowIdx + 1] : null}
                    onDelete={handleDeleteTurn}
                    onEdit={handleEditTurn}
                    onRetry={handleRetryTurn}
                    onInsertManual={handleInsertManualTurn}
                    isUpdating={editingTurnId === row.key && isUpdating}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <TurnDeleteDialog
        isOpen={showDeleteDialog}
        cascade={turnToDelete?.cascade}
        isDeleting={isDeleting}
        onSubmit={handleConfirmDelete}
        onClose={handleCancelDelete}
      />
      <RetryIntentDialog
        isOpen={Boolean(retryTurn)}
        turn={retryTurn}
        isSubmitting={isRetrying}
        onSubmit={handleRetrySubmit}
        onClose={handleRetryClose}
      />
      <InsertTurnDialog
        isOpen={Boolean(manualTurnTarget)}
        turn={manualTurnTarget}
        isSubmitting={isInsertingManualTurn}
        onSubmit={handleManualInsertSubmit}
        onClose={handleManualInsertClose}
      />
    </>
  );
}

function TimelineHeader({
  scenarioTitle,
  chapterLabel,
  isFetching,
}: {
  scenarioTitle: string;
  chapterLabel?: string;
  isFetching?: boolean;
}) {
  return (
    <Box textAlign="center" py={8}>
      <Heading size="lg" mb={2}>
        {scenarioTitle}
      </Heading>
      <ChapterSeparator label={chapterLabel} />

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
