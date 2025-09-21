import { Box, Flex } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/contracts";
import { memo, useMemo } from "react";
import { IntentProvenanceIndicator } from "./intent-provenance-indicator";
import { getIntentProvenanceDisplay } from "./intent-provenance-utils";
import { TurnItem } from "./turn-item";

interface TimelineTurnRowProps {
  turn: TimelineTurn;
  prevTurn: TimelineTurn | null;
  nextTurn: TimelineTurn | null;
  onDelete?: (turnId: string, cascade: boolean) => void;
  onEdit?: (turnId: string, content: string) => void;
  onRetry?: (turnId: string, parentId: string | null) => void;
  isUpdating?: boolean;
}

function TimelineTurnRowImpl(props: TimelineTurnRowProps) {
  const { turn, prevTurn, nextTurn, ...handlers } = props;

  const provenanceDisplay = useMemo(
    () => getIntentProvenanceDisplay(turn, prevTurn, nextTurn),
    [turn, prevTurn, nextTurn]
  );

  return (
    <Flex align="stretch" gap={2} width="100%" pb={4}>
      {provenanceDisplay && <IntentProvenanceIndicator display={provenanceDisplay} />}
      <Box flex="1">
        <TurnItem turn={turn} {...handlers} />
      </Box>
    </Flex>
  );
}

export const TimelineTurnRow = memo(TimelineTurnRowImpl);
