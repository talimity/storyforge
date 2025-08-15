import { Box, Flex } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface PlayerLayoutProps {
  turnHistory: ReactNode;
  intentPanel: ReactNode;
}

/**
 * The main layout for the scenario player content area.
 * This component handles the vertical split between turn history and input panel.
 */
export function PlayerLayout({ turnHistory, intentPanel }: PlayerLayoutProps) {
  return (
    <Flex direction="column" h="100%" position="relative">
      {/* Turn History Display - Takes up most of the space */}
      <Box
        flex="1"
        overflow="auto"
        px={{ base: 4, md: 8, lg: 12 }}
        py={{ base: 4, md: 6 }}
        // make sure last item does not get overlapped by the input panel
        pb={{ base: 32, md: 40 }}
      >
        <Box maxW="3xl" mx="auto">
          {turnHistory}
        </Box>
      </Box>

      {/* Input Panel - Fixed at bottom */}
      <Box
        position="sticky"
        bottom="0"
        left="0"
        right="0"
        mb={{ base: 0, md: 2 }}
        mx={{ base: 0, md: 2 }}
        layerStyle="contrast"
        shadow="subtle"
        zIndex="overlay"
      >
        <Box
          maxW="container.lg"
          mx="auto"
          px={{ base: 4, md: 8, lg: 12 }}
          py={{ base: 3, md: 4 }}
        >
          {intentPanel}
        </Box>
      </Box>
    </Flex>
  );
}
