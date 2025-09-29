import { Box, Flex } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/contracts";
import { memo, useMemo } from "react";
import { ChapterSeparator } from "@/features/scenario-player/components/timeline/chapter-separator";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { TurnItem, type TurnItemProps } from "./turn-item";

interface TimelineTurnRowProps extends TurnItemProps {
  prevTurn: TimelineTurn | null;
  nextTurn: TimelineTurn | null;
}

function TimelineTurnRowImpl(props: TimelineTurnRowProps) {
  const { turn, prevTurn, nextTurn, ...handlers } = props;
  const { chaptersByEventId, chapterLabelsByEventId, deriveChapterLabel } = useScenarioContext();

  const chapterEvent = useMemo(
    () => turn.events.find((event) => event.kind === "chapter_break"),
    [turn.events]
  );
  const chapterLabel = chapterEvent
    ? (chapterLabelsByEventId[chapterEvent.id] ??
      (chaptersByEventId[chapterEvent.id]
        ? deriveChapterLabel(chaptersByEventId[chapterEvent.id])
        : undefined))
    : undefined;

  return (
    <Box width="100%" pb={4}>
      <Flex align="stretch" gap={2} width="100%">
        <Box flex="1">
          <TurnItem turn={turn} prevTurn={prevTurn} nextTurn={nextTurn} {...handlers} />
        </Box>
      </Flex>
      {chapterLabel ? <ChapterSeparator label={chapterLabel} /> : null}
    </Box>
  );
}

export const TimelineTurnRow = memo(TimelineTurnRowImpl);
