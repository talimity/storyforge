import { Box, Flex, Presence } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/contracts";
import { memo } from "react";
import { ChapterSeparator } from "@/features/scenario-player/components/timeline/chapter-separator";
import {
  selectOverlayForTurn,
  useTurnUiStore,
} from "@/features/scenario-player/stores/turn-ui-store";
import { RetryInline } from "./retry-inline";
import { TurnItem } from "./turn-item";

interface TimelineTurnRowProps {
  turn: TimelineTurn;
  prevTurn: TimelineTurn | null;
  nextTurn: TimelineTurn | null;
}

function TimelineTurnRowImpl(props: TimelineTurnRowProps) {
  const { turn, prevTurn, nextTurn } = props;
  const overlay = useTurnUiStore(selectOverlayForTurn(turn.id));
  const isRetryActive = overlay?.mode === "retry";

  const chapterEvent = turn.events.find((event) => event.kind === "chapter_break");

  return (
    <Box width="100%" pb={4} data-testid="timeline-turn-row">
      <Flex align="stretch" gap={2} width="100%">
        <Box flex="1" maxW="100%">
          <Presence
            data-testid="turn-retry-presence"
            lazyMount
            unmountOnExit
            present={isRetryActive}
            position={isRetryActive ? "relative" : "absolute"}
            animationName={{
              _open: "slide-from-right-full, fade-in",
              _closed: "slide-to-right-full, fade-out",
            }}
            animationDuration="moderate"
          >
            <RetryInline turn={turn} />
          </Presence>
          <Box
            data-testid="turn-item-presence"
            data-state={isRetryActive ? "closed" : "open"}
            position={!isRetryActive ? "relative" : "absolute"}
            top="0"
            inert={isRetryActive}
            animationName={{
              _open: "slide-from-left-full, fade-in",
              _closed: "slide-to-left-full, fade-out",
            }}
            animationDuration="moderate"
            css={{
              "&[data-state=closed]": {
                opacity: 0,
                // in case user is using some ancient browser that doesn't support inert
                pointerEvents: "none",
                userSelect: "none",
              },
            }}
            aria-hidden={isRetryActive} // also no longer needed with inert
          >
            <TurnItem turn={turn} prevTurn={prevTurn} nextTurn={nextTurn} />
          </Box>
        </Box>
      </Flex>
      {chapterEvent ? <ChapterSeparator chapterEventId={chapterEvent.id} /> : null}
    </Box>
  );
}

export const TimelineTurnRow = memo(TimelineTurnRowImpl);
