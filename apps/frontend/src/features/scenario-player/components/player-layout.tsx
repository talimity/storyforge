import { Box, Flex, useToken } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface PlayerLayoutProps {
  timeline: ReactNode;
  intentPanel: ReactNode;
}

/**
 * The main layout for the scenario player content area.
 * This component handles the vertical split between timeline and input panel.
 */
export function PlayerLayout({ timeline, intentPanel }: PlayerLayoutProps) {
  const [maxW] = useToken("sizes", ["3xl"]);

  return (
    <Flex direction="column" h="100%" data-testid="player-layout">
      {/* Turn History Slot */}
      <Box flex="1" overflow="hidden" minH="0" mx="1" minW="0" data-testid="player-layout-timeline">
        {timeline}
      </Box>

      {/* Prompt Slot */}
      <Box
        mb={{ base: 0, md: 2 }}
        mx={{ base: 0, md: 2 }}
        data-testid="player-layout-intent"
        maxW="100%"
        minW="0"
      >
        <Box
          maxW={`calc(${maxW} + 2rem)`}
          layerStyle="contrast"
          shadow="subtle"
          zIndex="docked"
          minW="0"
          mx="auto"
          data-testid="player-intent-panel"
        >
          {intentPanel}
        </Box>
      </Box>
    </Flex>
  );
}
