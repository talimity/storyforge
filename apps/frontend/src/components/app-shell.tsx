import {
  Box,
  Drawer,
  Flex,
  Grid,
  Heading,
  IconButton,
  Portal,
  useBreakpointValue,
  VisuallyHidden,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { LuMenu } from "react-icons/lu";
import { Outlet } from "react-router-dom";
import { ErrorBoundary } from "@/components/error-boundary";
import { RouteProgress } from "@/components/route-progress";
import { Sidebar } from "@/components/sidebar";
import { PageHeaderProvider, useCurrentPageHeader } from "@/components/ui/page-header";

export function AppShell() {
  return (
    <PageHeaderProvider>
      <AppShellInner />
    </PageHeaderProvider>
  );
}

function AppShellInner() {
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem("sidebar-expanded");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useBreakpointValue({ base: true, md: false });
  const currentHeader = useCurrentPageHeader();

  useEffect(() => {
    localStorage.setItem("sidebar-expanded", JSON.stringify(sidebarExpanded));
  }, [sidebarExpanded]);

  const toggleSidebar = () => setSidebarExpanded(!sidebarExpanded);

  return (
    <Flex direction="column" h="100dvh" data-testid="app-shell">
      {/* Mobile Header + Drawer: mounted always, visible only on mobile */}
      <Drawer.Root open={drawerOpen} onOpenChange={(e) => setDrawerOpen(e.open)} placement="start">
        <Grid
          as="header"
          display={{ base: "grid", md: "none" }}
          h="12"
          px={2}
          bg="surface"
          gridTemplateColumns="1fr auto 1fr"
          alignItems="center"
          gap={1}
          data-testid="mobile-header"
          borderBottomWidth="1px"
          borderBottomColor="border"
        >
          <Flex justifySelf="start" gap={0.5} alignItems="center">
            <Drawer.Trigger asChild>
              <IconButton
                variant="ghost"
                size="sm"
                data-testid="mobile-menu-button"
                aria-label="Open Menu"
              >
                <LuMenu />
              </IconButton>
            </Drawer.Trigger>
          </Flex>
          <Flex
            justifySelf="center"
            alignItems="center"
            overflow="hidden"
            gridColumn="2"
            minW={0}
            maxW="100%"
          >
            {currentHeader?.title ? (
              <Heading size="md" truncate as="h1">
                {currentHeader.title}
              </Heading>
            ) : null}
          </Flex>
          <Flex justifySelf="end">
            {/* Placeholder for right-aligned items if needed in future */}
          </Flex>
        </Grid>
        <Drawer.Backdrop />
        <Portal>
          <Drawer.Positioner>
            <Drawer.Content data-testid="mobile-drawer" w="min-content">
              <VisuallyHidden>
                <Drawer.CloseTrigger />
              </VisuallyHidden>
              <Drawer.Body p="0" asChild>
                <Sidebar collapsed={false} />
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

      {/* Unified Layout: sidebar + main. Sidebar is hidden on mobile via wrapper */}
      <Flex flex="1" overflow="hidden" data-testid={isMobile ? undefined : "desktop-layout"}>
        {/* Sidebar (desktop only) */}
        <Box display={{ base: "none", md: "block" }}>
          <Sidebar collapsed={!sidebarExpanded} onToggleCollapse={toggleSidebar} />
        </Box>

        {/* Main Content */}
        <Flex
          as="main"
          direction="column"
          flex="1"
          overflowY="auto"
          overflowX="hidden"
          data-testid="main-content"
        >
          <RouteProgress />
          <Box
            p={{ base: 0, md: 4 }}
            pb={24} // Provide space for action bars/sticky footers
            maxW={{ base: "100%", md: "container.xl" }}
            data-testid="main-container"
          >
            <ErrorBoundary fallbackTitle="Application Error">
              <Outlet />
            </ErrorBoundary>
          </Box>
        </Flex>
      </Flex>
    </Flex>
  );
}
