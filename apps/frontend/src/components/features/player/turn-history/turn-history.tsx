import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/schemas";
import { TurnDeleteDialog } from "@/components/dialogs/turn-delete";
import { useAutoLoadMore } from "@/lib/hooks/use-auto-load-more";
import { useTurnActions } from "@/lib/hooks/use-turn-actions";
import { TurnItem } from "./turn-item";

interface TurnHistoryProps {
  scenarioTitle: string;
  chapterTitle?: string;
  turns: TimelineTurn[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onTurnDeleted?: () => void;
}

export function TurnHistory({
  scenarioTitle,
  chapterTitle,
  turns,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onTurnDeleted,
}: TurnHistoryProps) {
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
          <Box textAlign="center" py={8} color="content.muted">
            <Text>Nothing here yet.</Text>
            {/*  TODO: Add CharacterStarterSelector when no turns */}
          </Box>
        ) : (
          <Stack gap={4} px={4} pb={4}>
            {turns.map((turn) => (
              <TurnItem
                key={turn.id}
                turn={turn}
                onDelete={handleDeleteTurn}
                onEdit={handleEditTurn}
                isDeleting={turnToDelete === turn.id && isDeleting}
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
      />
    </>
  );
}
