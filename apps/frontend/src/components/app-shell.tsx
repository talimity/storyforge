import {
  Box,
  Button,
  ClientOnly,
  Collapsible,
  Container,
  Drawer,
  Flex,
  Grid,
  GridItem,
  Portal,
  Show,
  Skeleton,
  Stack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ColorModeToggle } from "@/components/color-mode-toggle";

const NavigationContent = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Stack p={4} gap={2}>
      <Button
        variant={isActive("/dashboard") ? "solid" : "ghost"}
        justifyContent="flex-start"
        width="100%"
        onClick={() => navigate("/dashboard")}
      >
        📊 Dashboard
      </Button>
      <Button
        variant={isActive("/characters") ? "solid" : "ghost"}
        justifyContent="flex-start"
        width="100%"
        onClick={() => navigate("/characters")}
      >
        👤 Characters
      </Button>
      <Button
        variant={isActive("/scenarios") ? "solid" : "ghost"}
        justifyContent="flex-start"
        width="100%"
        onClick={() => navigate("/scenarios")}
      >
        📖 Scenarios
      </Button>
    </Stack>
  );
};

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <Box minH="100vh">
      {/* Mobile Layout */}
      <Show when={isMobile}>
        <Drawer.Root placement="start">
          <Flex
            as="header"
            p={4}
            borderBottomWidth="1px"
            justify="space-between"
            align="center"
          >
            <Drawer.Trigger asChild>
              <Button variant="ghost" size="sm">
                ☰
              </Button>
            </Drawer.Trigger>
            <Box fontWeight="bold">StoryForge</Box>
            <ClientOnly fallback={<Skeleton w="10" h="10" rounded="md" />}>
              <ColorModeToggle />
            </ClientOnly>
          </Flex>
          <Portal>
            <Drawer.Backdrop />
            <Drawer.Positioner>
              <Drawer.Content>
                <Drawer.Header>
                  <Drawer.Title>Navigation</Drawer.Title>
                </Drawer.Header>
                <Drawer.Body>
                  <NavigationContent />
                </Drawer.Body>
              </Drawer.Content>
            </Drawer.Positioner>
          </Portal>
          <Box p={4}>
            <Outlet />
          </Box>
        </Drawer.Root>
      </Show>

      {/* Desktop Layout */}
      <Show when={!isMobile}>
        <Grid
          templateAreas={`"sidebar header"
                          "sidebar main"`}
          templateColumns={sidebarOpen ? "250px 1fr" : "60px 1fr"}
          templateRows="60px 1fr"
          minH="100vh"
          transition="all 0.2s"
        >
          <GridItem area="sidebar" borderRightWidth="1px">
            <Collapsible.Root
              open={sidebarOpen}
              onOpenChange={({ open }) => setSidebarOpen(open)}
            >
              <Flex
                p={4}
                borderBottomWidth="1px"
                justify={sidebarOpen ? "space-between" : "center"}
              >
                <Collapsible.Trigger asChild>
                  <Button variant="ghost" size="sm">
                    ☰
                  </Button>
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <Box fontWeight="bold" fontSize="sm">
                    StoryForge
                  </Box>
                </Collapsible.Content>
              </Flex>
              <Collapsible.Content>
                <NavigationContent />
              </Collapsible.Content>
            </Collapsible.Root>
          </GridItem>

          <GridItem area="header" borderBottomWidth="1px">
            <Flex align="center" justify="flex-end" p={4}>
              <ClientOnly fallback={<Skeleton w="10" h="10" rounded="md" />}>
                <ColorModeToggle />
              </ClientOnly>
            </Flex>
          </GridItem>

          <GridItem area="main" overflow="auto">
            <Container p={6} maxW="container.xl">
              <Outlet />
            </Container>
          </GridItem>
        </Grid>
      </Show>
    </Box>
  );
}
