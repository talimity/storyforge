import { Box, ClientOnly, Flex, HStack, Separator, Skeleton, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  LuBookOpen,
  LuChevronLeft,
  LuChevronRight,
  LuImages,
  LuLibrary,
  LuPaintBucket,
  LuPlay,
  LuScrollText,
  LuUsersRound,
  LuWorkflow,
} from "react-icons/lu";
import { TbCubeSpark } from "react-icons/tb";
import { ColorModeToggle } from "@/components/color-mode-toggle";
import { Logo } from "@/components/logo";
import { SidebarLink } from "@/components/sidebar-link";
import { Button } from "@/components/ui";
import { useActiveScenarioWithData } from "@/hooks/use-active-scenario";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse?: () => void;
}

type NavItem = {
  readonly to: string;
  readonly icon: IconType;
  readonly label: string;
};

type NavSection = {
  readonly key: string;
  readonly title: string;
  readonly items: readonly NavItem[];
};

const NAV_SECTIONS: readonly NavSection[] = [
  {
    key: "library",
    title: "Library",
    items: [
      { to: "/characters", icon: LuUsersRound, label: "Characters" },
      { to: "/scenarios", icon: LuBookOpen, label: "Scenarios" },
      { to: "/lorebooks", icon: LuLibrary, label: "Lorebooks" },
      { to: "/assets", icon: LuImages, label: "Assets" },
    ],
  },
  {
    key: "generation",
    title: "Generation",
    items: [
      { to: "/workflows", icon: LuWorkflow, label: "Workflows" },
      { to: "/templates", icon: LuScrollText, label: "Prompts" },
      { to: "/models", icon: TbCubeSpark, label: "Models" },
    ],
  },
  {
    key: "tools",
    title: "Tools",
    items: [{ to: "/theme-demo", icon: LuPaintBucket, label: "Design System" }],
  },
];

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const { activeScenarioId, scenarioQuery, hasValidActiveScenario } = useActiveScenarioWithData();

  const isLoading = scenarioQuery.isLoading;

  return (
    <Stack
      as="nav"
      h="100dvh"
      w={collapsed ? "16" : "60"}
      bg="bg.panel"
      boxShadow={collapsed ? "1px 0 0 0 var(--chakra-colors-border)" : "xl"}
      borderRightWidth={collapsed ? "0" : "1px"}
      transition="width 0.2s"
      position="sticky"
      data-testid="sidebar"
    >
      {/* Logo Section */}
      <Logo collapsed={collapsed} />

      {/* Collapse Toggle Button */}
      <Button
        variant="plain"
        size="2xs"
        position="absolute"
        top="4"
        right="-1.5"
        zIndex="12"
        rounded="full"
        boxSize="8"
        onClick={onToggleCollapse}
        data-testid="sidebar-toggle"
        display={onToggleCollapse ? "flex" : "none"}
      >
        {collapsed ? <LuChevronRight /> : <LuChevronLeft />}
      </Button>

      {/* Main Navigation */}
      <Stack gap="1" flex="1" py="4" px="3" overflowY="auto" data-testid="sidebar-nav">
        {isLoading && (
          <HStack pl="4">
            <Skeleton h="6" w="6" rounded="md" />
            <Stack gap="2">
              <Skeleton h="4" w="28" rounded="md" />
              <Skeleton h="4" w="24" rounded="md" />
            </Stack>
          </HStack>
        )}

        {hasValidActiveScenario && (
          <SidebarLink
            to={`/play/${activeScenarioId}`}
            icon={<LuPlay />}
            label={
              <Flex direction="column" gap="0" lineHeight="1.25">
                <Text>Resume Scenario</Text>
                <Text fontSize="2xs" color="content.muted">
                  {scenarioQuery.data?.name}
                </Text>
              </Flex>
            }
            collapsed={collapsed}
          />
        )}

        {NAV_SECTIONS.map((section) => (
          <SidebarSection key={section.key} section={section} collapsed={collapsed} />
        ))}
      </Stack>

      {/* Bottom Actions */}
      <Box px="3" py="4" borderTopWidth="1px">
        {/* Color Mode Toggle */}
        <ClientOnly fallback={<Skeleton w="10" h="10" rounded="md" />}>
          <ColorModeToggle collapsed={collapsed} />
        </ClientOnly>
      </Box>
    </Stack>
  );
}

interface SidebarSectionProps {
  section: NavSection;
  collapsed: boolean;
}

function SidebarSection({ section, collapsed }: SidebarSectionProps) {
  return (
    <>
      {collapsed ? <Separator /> : <SectionHeader>{section.title}</SectionHeader>}
      {section.items.map((item) => {
        const Icon = item.icon;
        return (
          <SidebarLink
            key={item.to}
            to={item.to}
            icon={<Icon />}
            label={item.label}
            collapsed={collapsed}
          />
        );
      })}
    </>
  );
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="content.muted"
      px="4"
      pb="1"
      pt="3"
      textTransform="uppercase"
      letterSpacing="wider"
      textWrap="nowrap"
    >
      {children}
    </Text>
  );
}
