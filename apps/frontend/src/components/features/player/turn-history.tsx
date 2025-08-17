import { Box, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/schemas";
import { useAutoLoadMore } from "@/lib/hooks/use-auto-load-more";

interface TurnHistoryProps {
  scenarioTitle: string;
  chapterTitle?: string;
  turns: TimelineTurn[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  participants: Map<string, { name: string; type: string }>;
}

export function TurnHistory({
  scenarioTitle,
  chapterTitle,
  turns,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  participants,
}: TurnHistoryProps) {
  const { containerRef, topSentinelRef } = useAutoLoadMore({
    itemCount: turns.length,
    onLoadMore,
    enabled: !!hasNextPage,
    isFetching: !!isFetchingNextPage,
    rootMargin: "200px 0px 0px 0px",
  });

  return (
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
            Loading earlier turns...
          </Text>
        </Box>
      )}

      <Box ref={topSentinelRef} />

      {/* Turn list */}
      {turns.length === 0 ? (
        <Box textAlign="center" py={8} color="content.muted">
          <Text>
            No turns yet. Use the input panel below to add some content!
          </Text>
        </Box>
      ) : (
        <Stack gap={4} px={4} pb={4}>
          {turns.map((turn) => {
            const author = participants.get(turn.authorParticipantId);
            const turnNumber = turn.turnNo;

            return (
              <Box key={turn.id} layerStyle="surface" p={4} borderRadius="md">
                <Stack gap={2}>
                  <HStack justify="space-between" mb={1}>
                    <Text
                      fontSize="sm"
                      fontWeight="semibold"
                      color="content.emphasized"
                    >
                      {author?.name || "Unknown"}
                    </Text>
                    <Text fontSize="xs" color="content.muted">
                      Turn #{turnNumber}
                    </Text>
                  </HStack>
                  <Text whiteSpace="pre-wrap">{turn.content.text}</Text>
                  {turn.swipes && turn.swipes.swipeCount > 1 && (
                    <Text fontSize="xs" color="content.muted">
                      Variation {turn.swipes.swipeNo} of{" "}
                      {turn.swipes.swipeCount}
                    </Text>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
