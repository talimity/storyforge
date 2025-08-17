import {
  Box,
  ClientOnly,
  Container,
  Drawer,
  Flex,
  Portal,
  Show,
  Skeleton,
  useBreakpointValue,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { LuMenu } from "react-icons/lu";
import { Outlet } from "react-router-dom";
import { ColorModeToggle } from "@/components/color-mode-toggle";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { Logo } from "@/components/logo";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui";

export function AppShell() {
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem("sidebar-expanded");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useBreakpointValue({ base: true, md: false });

  useEffect(() => {
    localStorage.setItem("sidebar-expanded", JSON.stringify(sidebarExpanded));
  }, [sidebarExpanded]);

  const toggleSidebar = () => setSidebarExpanded(!sidebarExpanded);

  return (
    <Box minH="100vh" data-testid="app-shell" colorPalette="neutral">
      {/* Mobile Layout */}
      <Show when={isMobile}>
        <Drawer.Root
          open={drawerOpen}
          onOpenChange={(e) => setDrawerOpen(e.open)}
        >
          <Flex
            as="header"
            p={4}
            borderBottomWidth="1px"
            justify="space-between"
            align="center"
            bg="bg.surface"
            data-testid="mobile-header"
          >
            <Drawer.Trigger asChild>
              <Button
                variant="ghost"
                size="sm"
                data-testid="mobile-menu-button"
              >
                <LuMenu />
              </Button>
            </Drawer.Trigger>
            <Logo collapsed />
            <ClientOnly fallback={<Skeleton w="10" h="10" rounded="md" />}>
              <ColorModeToggle />
            </ClientOnly>
          </Flex>
          <Portal>
            <Drawer.Backdrop />
            <Drawer.Positioner>
              <Drawer.Content data-testid="mobile-drawer">
                <Drawer.Header>
                  <Drawer.Title>Navigation</Drawer.Title>
                  <Drawer.CloseTrigger />
                </Drawer.Header>
                <Drawer.Body p="0">
                  <Box onClick={() => setDrawerOpen(false)}>
                    <Sidebar collapsed={false} onToggleCollapse={() => {}} />
                  </Box>
                </Drawer.Body>
              </Drawer.Content>
            </Drawer.Positioner>
          </Portal>
          <Box as="main" p={4} data-testid="mobile-main-content">
            <ErrorBoundary fallbackTitle="Application Error">
              <Outlet />
            </ErrorBoundary>
          </Box>
        </Drawer.Root>
      </Show>

      {/* Desktop Layout */}
      <Show when={!isMobile}>
        <Flex h="100vh" data-testid="desktop-layout">
          {/* Sidebar */}
          <Sidebar
            collapsed={!sidebarExpanded}
            onToggleCollapse={toggleSidebar}
          />

          {/* Main Content */}
          <Flex
            as="main"
            direction="column"
            flex="1"
            overflow="auto"
            data-testid="desktop-main-content"
          >
            {/* Main Content Area */}
            {/* <Box flex="1"> */}
            <Container
              p={6}
              pb={24} // Provide space for action bars/sticky footers
              maxW="container.xl"
              data-testid="main-container"
            >
              <ErrorBoundary fallbackTitle="Application Error">
                <Outlet />
              </ErrorBoundary>
            </Container>
            {/* </Box> */}
          </Flex>
        </Flex>
      </Show>
    </Box>
  );
}
