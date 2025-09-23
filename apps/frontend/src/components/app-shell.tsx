import {
  Box,
  ClientOnly,
  Container,
  Drawer,
  Flex,
  Portal,
  Skeleton,
  useBreakpointValue,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { LuMenu } from "react-icons/lu";
import { Outlet } from "react-router-dom";
import { ColorModeToggle } from "@/components/color-mode-toggle";
import { ErrorBoundary } from "@/components/error-boundary";
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
    <Box minH="100dvh" data-testid="app-shell" colorPalette="neutral">
      {/* Mobile Header + Drawer: mounted always, visible only on mobile */}
      <Drawer.Root open={drawerOpen} onOpenChange={(e) => setDrawerOpen(e.open)}>
        <Flex
          as="header"
          p={4}
          borderBottomWidth="1px"
          justify="space-between"
          align="center"
          bg="bg.surface"
          data-testid="mobile-header"
          display={{ base: "flex", md: "none" }}
        >
          <Drawer.Trigger asChild>
            <Button variant="ghost" size="sm" data-testid="mobile-menu-button">
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
      </Drawer.Root>

      {/* Unified Layout: sidebar + main. Sidebar is hidden on mobile via wrapper */}
      <Flex h="100dvh" data-testid={isMobile ? undefined : "desktop-layout"}>
        {/* Sidebar (desktop only) */}
        <Box display={{ base: "none", md: "block" }}>
          <Sidebar collapsed={!sidebarExpanded} onToggleCollapse={toggleSidebar} />
        </Box>

        {/* Main Content */}
        <Flex
          as="main"
          direction="column"
          flex="1"
          overflow="auto"
          data-testid={isMobile ? "mobile-main-content" : "desktop-main-content"}
        >
          <Container
            p={{ base: 4, md: 6 }}
            pb={24} // Provide space for action bars/sticky footers
            maxW={{ base: "100%", md: "container.xl" }}
            data-testid="main-container"
          >
            <ErrorBoundary fallbackTitle="Application Error">
              <Outlet />
            </ErrorBoundary>
          </Container>
        </Flex>
      </Flex>
    </Box>
  );
}
