import {
  Box,
  ClientOnly,
  Separator,
  Skeleton,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import {
  LuBookOpen,
  LuBrain,
  LuChevronLeft,
  LuChevronRight,
  LuHouse,
  LuPaintBucket,
  LuSettings,
  LuUsers,
  LuWorkflow,
} from "react-icons/lu";
import { ColorModeToggle } from "./color-mode-toggle";
import { Logo } from "./logo";
import { SidebarLink } from "./sidebar-link";
import { Button } from "./ui";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <Stack
      as="nav"
      h="100vh"
      w={collapsed ? "64px" : "240px"}
      bg="surface.subtle/80"
      boxShadow={
        collapsed ? "1px 0 0 0 var(--chakra-colors-border)" : undefined
      }
      borderRightWidth={collapsed ? "0" : "1px"}
      transition="width 0.2s"
      position="sticky"
      data-testid="sidebar"
    >
      {/* Logo Section */}
      <Logo collapsed={collapsed} />

      {/* Collapse Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        position="absolute"
        top="11"
        right="-3"
        zIndex="10"
        rounded="full"
        boxSize="6"
        minW="unset"
        onClick={onToggleCollapse}
        bg="bg.surface"
        borderWidth="1px"
        _hover={{
          bg: "bg.subtle",
        }}
        data-testid="sidebar-toggle"
      >
        {collapsed ? <LuChevronRight size={14} /> : <LuChevronLeft size={14} />}
      </Button>

      {/* Main Navigation */}
      <Stack
        gap="1"
        flex="1"
        py="4"
        px="3"
        overflowY="auto"
        data-testid="sidebar-nav"
      >
        {/* Home */}
        <SidebarLink
          to="/"
          icon={<LuHouse />}
          label="Home"
          collapsed={collapsed}
        />

        {/* Library Section */}
        {collapsed ? <Separator /> : <SectionHeader>Library</SectionHeader>}

        <SidebarLink
          to="/characters"
          icon={<LuUsers />}
          label="Characters"
          collapsed={collapsed}
        />

        <SidebarLink
          to="/scenarios"
          icon={<LuBookOpen />}
          label="Scenarios"
          collapsed={collapsed}
        />

        <SidebarLink
          to="/models"
          icon={<LuBrain />}
          label="Models"
          collapsed={collapsed}
        />

        <SidebarLink
          to="/agents"
          icon={<LuWorkflow />}
          label="Agents"
          collapsed={collapsed}
        />

        {/* Dev tools Section */}
        {collapsed ? (
          <Separator />
        ) : (
          <SectionHeader>Developer Tools</SectionHeader>
        )}

        <SidebarLink
          to="/theme-demo"
          icon={<LuPaintBucket />}
          label="Design System"
          collapsed={collapsed}
        />
      </Stack>

      {/* Settings at Bottom */}
      <Box px="3" py="4" borderTopWidth="1px">
        <Stack gap="1">
          {/* Color Mode Toggle */}
          <ClientOnly fallback={<Skeleton w="10" h="10" rounded="md" />}>
            <ColorModeToggle collapsed={collapsed} />
          </ClientOnly>

          <SidebarLink
            to="/settings"
            icon={<LuSettings />}
            label="Settings"
            collapsed={collapsed}
          />
        </Stack>
      </Box>
    </Stack>
  );
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="fg.muted"
      px="4"
      py="2"
      textTransform="uppercase"
      letterSpacing="wider"
      textWrap="nowrap"
    >
      {children}
    </Text>
  );
}
