import {
  Box,
  Drawer,
  Flex,
  HStack,
  IconButton,
  Portal,
  Show,
  Skeleton,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import { Suspense, useState } from "react";
import { LuArrowLeft, LuEllipsisVertical, LuMenu, LuSettings } from "react-icons/lu";
import { Navigate, Outlet, useNavigate, useParams } from "react-router-dom";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/index";
import { PlayerWidgetSidebar } from "@/features/scenario-player/components/player-widget-sidebar";

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
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isMobile = useBreakpointValue({ base: true, lg: false });

  const { scenario, characters } = useScenarioContext();

  const handleBack = () => {
    navigate("/scenarios");
  };

  const toggleSidebar = () => setSidebarExpanded(!sidebarExpanded);

  return (
    <Flex direction="column" h="100vh" colorPalette="neutral">
      {/* Top Scenario Title Bar */}
      <Flex
        as="header"
        h="12"
        px={4}
        bg="surface"
        align="center"
        justify="space-between"
        flexShrink={0}
      >
        {/* Left Section */}
        <HStack gap={3}>
          {/* Mobile menu button */}
          <Show when={isMobile}>
            <IconButton variant="ghost" size="sm" onClick={() => setMobileDrawerOpen(true)}>
              <LuMenu />
            </IconButton>
          </Show>

          {/* Back button */}
          <Button variant="ghost" size="sm" onClick={handleBack} data-testid="scenario-back-button">
            <LuArrowLeft />
            Back to Library
          </Button>
        </HStack>

        {/* Center Section - Scenario Title */}
        <Box flex="1" textAlign="center" px={4}>
          <Text fontWeight="medium" fontSize="sm" lineClamp={1}>
            {scenario.title}
          </Text>
        </Box>

        {/* Right Section - Meta Toolbar */}
        <HStack gap={2}>
          <IconButton variant="ghost" size="sm">
            <LuSettings />
          </IconButton>
          <IconButton variant="ghost" size="sm">
            <LuEllipsisVertical />
          </IconButton>
        </HStack>
      </Flex>

      {/* Main Layout */}
      <Flex flex="1" overflow="hidden">
        {/* Desktop Widget Sidebar */}
        <Show when={!isMobile}>
          <PlayerWidgetSidebar
            expanded={sidebarExpanded}
            onToggle={toggleSidebar}
            characters={characters}
          />
        </Show>

        {/* Mobile Widget Drawer */}
        <Show when={isMobile}>
          <Drawer.Root open={mobileDrawerOpen} onOpenChange={(e) => setMobileDrawerOpen(e.open)}>
            <Portal>
              <Drawer.Backdrop />
              <Drawer.Positioner>
                <Drawer.Content>
                  <Drawer.Header>
                    <Drawer.Title>Scenario Controls</Drawer.Title>
                    <Drawer.CloseTrigger />
                  </Drawer.Header>
                  <Drawer.Body p="0">
                    <Box onClick={() => setMobileDrawerOpen(false)}>
                      <PlayerWidgetSidebar expanded={true} characters={characters} />
                    </Box>
                  </Drawer.Body>
                </Drawer.Content>
              </Drawer.Positioner>
            </Portal>
          </Drawer.Root>
        </Show>

        {/* Main Content Area */}
        <Box
          as="main"
          flex="1"
          overflow="auto"
          layerStyle="surface"
          borderRadius="0"
          borderTopLeftRadius={isMobile ? "0" : "sm"}
          boxShadow="inset 0 0 8px rgba(0, 0, 0, 0.1)"
          data-testid="scenario-main-content"
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
        <Box w="64" p={3} display={{ base: "none", lg: "block" }}>
          <Skeleton height="5" mb={3} />
          <Skeleton height="16" mb={2} />
          <Skeleton height="16" mb={2} />
        </Box>
        <Box as="main" flex="1" p={4}>
          <Skeleton height="200px" />
        </Box>
      </Flex>
    </Flex>
  );
}
