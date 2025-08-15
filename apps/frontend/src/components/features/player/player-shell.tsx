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
import { useState } from "react";
import {
  LuArrowLeft,
  LuEllipsisVertical,
  LuMenu,
  LuSettings,
} from "react-icons/lu";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { PlayerWidgetSidebar } from "@/components/features/player/player-widget-sidebar";
import { Button } from "@/components/ui";
import { trpc } from "@/lib/trpc";

export function PlayerShell() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isMobile = useBreakpointValue({ base: true, lg: false });

  const scenarioQuery = trpc.scenarios.getById.useQuery(
    { id: id as string },
    { enabled: !!id }
  );

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
            <IconButton
              variant="ghost"
              size="sm"
              onClick={() => setMobileDrawerOpen(true)}
            >
              <LuMenu />
            </IconButton>
          </Show>

          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            data-testid="scenario-back-button"
          >
            <LuArrowLeft />
            Back to Library
          </Button>
        </HStack>

        {/* Center Section - Scenario Title */}
        <Box flex="1" textAlign="center" px={4}>
          {scenarioQuery.isLoading ? (
            <Skeleton height="5" width="200px" mx="auto" />
          ) : scenarioQuery.data ? (
            <Text fontWeight="medium" fontSize="sm" lineClamp={1}>
              {scenarioQuery.data.name}
            </Text>
          ) : null}
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
          />
        </Show>

        {/* Mobile Widget Drawer */}
        <Show when={isMobile}>
          <Drawer.Root
            open={mobileDrawerOpen}
            onOpenChange={(e) => setMobileDrawerOpen(e.open)}
          >
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
                      <PlayerWidgetSidebar expanded={true} />
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
