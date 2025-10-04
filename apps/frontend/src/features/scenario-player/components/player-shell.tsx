import {
  Box,
  Flex,
  HStack,
  IconButton,
  Show,
  Skeleton,
  useBreakpointValue,
} from "@chakra-ui/react";
import { Suspense, useEffect } from "react";
import { LuArrowLeft, LuSettings } from "react-icons/lu";
import { Link, Navigate, Outlet, useParams } from "react-router-dom";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/index";
import { ScenarioNavigation } from "@/features/scenario-player/components/scenario-navigation";

import {
  ScenarioProvider,
  useScenarioContext,
} from "@/features/scenario-player/providers/scenario-provider";

export function PlayerShell() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/scenarios" replace />;

  return (
    <ErrorBoundary fallbackTitle="Scenario Player Error">
      <Suspense fallback={<PlayerChromeSkeleton />}>
        <ScenarioProvider scenarioId={id}>
          <PlayerShellInner />
        </ScenarioProvider>
      </Suspense>
    </ErrorBoundary>
  );
}

function PlayerShellInner() {
  const isMobile = useBreakpointValue({ base: true, lg: false });

  const { scenario } = useScenarioContext();

  useEffect(() => {
    if (scenario.title) {
      document.title = `${scenario.title} - StoryForge`;
    } else {
      document.title = `Play Scenario - StoryForge`;
    }
  }, [scenario.title]);

  return (
    <Flex direction="column" h="100dvh" colorPalette="neutral" data-testid="player-shell">
      {/* Top Scenario Title Bar */}
      <Flex
        as="header"
        h="12"
        px={4}
        bg="surface"
        align="center"
        justify="space-between"
        flexShrink={0}
        data-testid="player-shell-header"
      >
        {/* Left Section */}
        <HStack gap={3}>
          {/* Mobile menu button */}
          <Show when={!isMobile}>
            <Button
              position="fixed"
              variant="ghost"
              size="sm"
              asChild
              data-testid="scenario-back-button"
            >
              <Link to="/scenarios">
                <LuArrowLeft />
                Library
              </Link>
            </Button>
          </Show>
        </HStack>

        {/* Center Section - Story Nav */}
        <Box flex="1" textAlign="center" px={4}>
          <ScenarioNavigation />
        </Box>

        {/* Right Section - Meta Toolbar */}
        <HStack gap={2}>
          <IconButton position="fixed" variant="ghost" size="sm">
            <LuSettings />
          </IconButton>
        </HStack>
      </Flex>

      {/* Main Layout */}
      <Flex flex="1" overflow="hidden" data-testid="player-shell-content">
        {/*Eventual toggleable side panel*/}

        {/* Content Area Layout */}
        <Box
          as="main"
          flex="1"
          minH="0"
          minW="0"
          layerStyle="surface"
          borderRadius="0"
          borderTopLeftRadius={isMobile ? "0" : "sm"}
          boxShadow="inset 0 0 8px rgba(0, 0, 0, 0.1)"
          data-testid="player-shell-main"
        >
          <Outlet />
        </Box>
      </Flex>
    </Flex>
  );
}

function PlayerChromeSkeleton() {
  return (
    <Flex direction="column" h="100vh">
      <Flex as="header" h="12" px={4} align="center" justify="space-between">
        <HStack gap={3}>
          <Skeleton height="8" width="80px" />
        </HStack>
        <Box flex="1" textAlign="center" px={4}>
          <Skeleton height="4" width="220px" mx="auto" />
        </Box>
        <HStack gap={2}>
          <Skeleton boxSize="8" />
          <Skeleton boxSize="8" />
        </HStack>
      </Flex>
      <Flex flex="1" overflow="hidden">
        <Box w="50%" p={3} display={{ base: "none", lg: "block" }}>
          <Skeleton height="5" mb={3} />
          <Skeleton height="16" mb={2} />
          <Skeleton height="16" mb={2} />
        </Box>
      </Flex>
    </Flex>
  );
}
