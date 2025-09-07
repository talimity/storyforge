import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/contracts";
import { CharacterStarterSelector } from "@/features/scenario-player/components/timeline/character-starter-selector";
import { TurnDeleteDialog } from "@/features/scenario-player/components/timeline/turn-delete-dialog";
import { TurnItem } from "@/features/scenario-player/components/timeline/turn-item";
import { useTurnActions } from "@/features/scenario-player/hooks/use-turn-actions";
import { useAutoLoadMore } from "@/hooks/use-auto-load-more";
import { trpc } from "@/lib/trpc";

interface TimelineProps {
  scenarioId: string;
  scenarioTitle: string;
  chapterTitle?: string;
  turns: TimelineTurn[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onTurnDeleted?: () => void;
  onStarterSelect?: (characterId: string, starterId: string) => void;
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
}: TimelineProps) {
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
  const { containerRef, topSentinelRef } = useAutoLoadMore({
    itemCount: turns.length,
    onLoadMore,
    enabled: !!hasNextPage,
    isFetching: !!isFetchingNextPage,
    rootMargin: "200px 0px 0px 0px",
  });

  const { data: startersData } = trpc.scenarios.getCharacterStarters.useQuery(
    { id: scenarioId },
    { enabled: turns.length === 0 } // skip if timeline is already populated
  );

  const handleStarterSelect = (characterId: string, starterId: string) => {
    onStarterSelect?.(characterId, starterId);
  };

  return (
    <>
      <Stack gap={6} ref={containerRef} h="100%" overflow="auto">
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
