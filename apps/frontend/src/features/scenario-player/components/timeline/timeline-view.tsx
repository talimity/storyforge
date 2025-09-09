import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/contracts";
import { useQuery } from "@tanstack/react-query";
import type { RefObject } from "react";
import { CharacterStarterSelector } from "@/features/scenario-player/components/timeline/character-starter-selector";
import { DraftTurn } from "@/features/scenario-player/components/timeline/draft-turn";
import { TurnDeleteDialog } from "@/features/scenario-player/components/timeline/turn-delete-dialog";
import { TurnItem } from "@/features/scenario-player/components/timeline/turn-item";
import { useTurnActions } from "@/features/scenario-player/hooks/use-turn-actions";
import { useTimelineScroller } from "@/features/scenario-player/hooks/use-turn-scroller";
import { useIntentRunsStore } from "@/features/scenario-player/stores/intent-run-store";
import { useTRPC } from "@/lib/trpc";

interface TimelineProps {
  scenarioId: string;
  scenarioTitle: string;
  chapterTitle?: string;
  turns: TimelineTurn[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onTurnDeleted?: () => void;
  onStarterSelect?: (characterId: string, message: string) => void;
  /** Ref to the actual scrollable container owned by PlayerLayout */
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function TimelineView({
  scenarioId,
  scenarioTitle,
  chapterTitle,
  turns,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onTurnDeleted,
  onStarterSelect,
  scrollRef,
}: TimelineProps) {
  const trpc = useTRPC();
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
  } = useTurnActions({
    onTurnDeleted,
    onTurnUpdated: onTurnDeleted, // Refresh timeline on update too
  });
  // Draft activity for bottom pinning (rising-edge scroll when draft appears)
  const isDraftActive = useIntentRunsStore((s) => {
    const id = s.currentRunId;
    if (!id) return false;
    const run = s.runsById[id];
    return run?.status === "pending" || run?.status === "running";
  });

  const { topSentinelRef } = useTimelineScroller({
    containerRef: scrollRef,
    itemIds: turns.map((t) => t.id),
    onLoadMore,
    hasNextPage: !!hasNextPage,
    isFetching: !!isFetchingNextPage,
    isGenerating: isDraftActive,
  });

  const { data: startersData } = useQuery(
    trpc.scenarios.getCharacterStarters.queryOptions(
      { id: scenarioId },
      { enabled: turns.length === 0 }
    )
  );

  const handleStarterSelect = (characterId: string, message: string) => {
    onStarterSelect?.(characterId, message);
  };

  return (
    <>
      {/* Content lives inside the external scroll container owned by PlayerLayout. */}
      <Stack gap={6}>
        {/* Chapter Header */}
        <Box textAlign="center" py={8}>
          <Heading size="lg" mb={2}>
            {scenarioTitle}
          </Heading>
          <Text color="content.muted">{chapterTitle || "No chapters"}</Text>
        </Box>

        {/* Loading indicator for pagination */}
        {isFetchingNextPage && (
          <Box textAlign="center" py={2}>
            <Text fontSize="sm" color="content.muted">
              Loading earlier history...
            </Text>
          </Box>
        )}

        <Box ref={topSentinelRef} />

        {/* Turn list */}
        {turns.length === 0 ? (
          startersData?.charactersWithStarters && startersData.charactersWithStarters.length > 0 ? (
            <CharacterStarterSelector
              charactersWithStarters={startersData.charactersWithStarters}
              onStarterSelect={handleStarterSelect}
            />
          ) : (
            <Box textAlign="center" color="content.muted">
              <Text>Nothing here yet.</Text>
            </Box>
          )
        ) : (
          <Stack px={2} pb={2}>
            {turns.map((turn) => (
              <TurnItem
                key={turn.id}
                turn={turn}
                onDelete={handleDeleteTurn}
                onEdit={handleEditTurn}
                isUpdating={editingTurnId === turn.id && isUpdating}
              />
            ))}
          </Stack>
        )}

        {/* Draft turn for in-progress generations */}
        <Box px={2} pb={2}>
          <DraftTurn />
        </Box>
      </Stack>

      <TurnDeleteDialog
        isOpen={showDeleteDialog}
        onOpenChange={(details) => setShowDeleteDialog(details.open)}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={isDeleting}
        cascade={turnToDelete?.cascade}
      />
    </>
  );
}
