import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/schemas";
import { memo } from "react";
import { Avatar } from "@/components/ui/index";
import { useScenarioCtx } from "@/lib/providers/scenario-provider";
import { getApiUrl } from "@/lib/trpc";

interface TurnItemProps {
  turn: TimelineTurn;
  onDelete?: (turnId: string) => void;
  onEdit?: (turnId: string) => void;
}

function TurnItemImpl({ turn }: TurnItemProps) {
  const { getCharacterByParticipantId } = useScenarioCtx();
  const authorChar = getCharacterByParticipantId(turn.authorParticipantId);
  const authorName = authorChar?.name ?? "Narrator";
  const avatarSrc = getApiUrl(authorChar?.avatarPath ?? undefined);

  // TODO: useTurnActions
  // const handleDelete = useCallback(
  //   () => onDelete?.(turn.id),
  //   [onDelete, turn.id]
  // );
  // const handleEdit = useCallback(() => onEdit?.(turn.id), [onEdit, turn.id]);

  return (
    <Box layerStyle="surface" p={4} borderRadius="md">
      <Stack gap={2}>
        <HStack justify="space-between" mb={1}>
          <HStack alignItems="center" mx={-1}>
            {avatarSrc && (
              <Avatar
                shape="rounded"
                layerStyle="surface"
                name={authorName}
                src={avatarSrc}
                size="2xs"
              />
            )}
            <Text fontSize="md" fontWeight="bold" color="content.emphasized">
              {authorName}
            </Text>
          </HStack>

          <Text fontSize="xs" color="content.muted">
            #{turn.turnNo}
          </Text>
        </HStack>
        <Text whiteSpace="pre-wrap">{turn.content.text}</Text>
        {turn.swipes && turn.swipes.swipeCount > 1 && (
          <Text fontSize="xs" color="content.muted">
            {turn.swipes.swipeNo} / {turn.swipes.swipeCount}
          </Text>
        )}
      </Stack>
    </Box>
  );
}

export const TurnItem = memo(
  TurnItemImpl,
  (prev, next) =>
    prev.turn.id === next.turn.id &&
    prev.turn.turnNo === next.turn.turnNo &&
    prev.turn.content.text === next.turn.content.text &&
    prev.turn.swipes?.swipeNo === next.turn.swipes?.swipeNo &&
    prev.turn.swipes?.swipeCount === next.turn.swipes?.swipeCount
);
