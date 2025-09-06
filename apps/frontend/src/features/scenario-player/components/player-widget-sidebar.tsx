import { Flex, IconButton, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuClapperboard,
  LuPalette,
  LuSettings2,
  LuUsers,
} from "react-icons/lu";
import { Button } from "@/components/ui/index";
import { WidgetPanels } from "./widgets/index";

interface Character {
  id: string;
  name: string;
  avatarPath: string | null;
}

interface PlayerWidgetSidebarProps {
  expanded: boolean;
  onToggle?: () => void;
  characters: Character[];
}

interface WidgetToggleProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  collapsed?: boolean;
}

function WidgetToggle({
  icon,
  label,
  isActive,
  onClick,
  collapsed = false,
}: WidgetToggleProps) {
  if (collapsed) {
    return (
      <IconButton
        variant={isActive ? "solid" : "ghost"}
        size="sm"
        onClick={onClick}
        title={label}
      >
        {icon}
      </IconButton>
    );
  }

  return (
    <Button
      variant={isActive ? "solid" : "ghost"}
      size="sm"
      onClick={onClick}
      justifyContent="flex-start"
      width="full"
    >
      {icon}
      <Text ml={2}>{label}</Text>
    </Button>
  );
}

export function PlayerWidgetSidebar({
  expanded,
  onToggle,
  characters,
}: PlayerWidgetSidebarProps) {
  // Track which widgets are active
  const [activeWidgets, setActiveWidgets] = useState<Set<string>>(
    new Set(["characters"])
  );

  const toggleWidget = (widgetId: string) => {
    setActiveWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(widgetId)) {
        next.delete(widgetId);
      } else {
        next.add(widgetId);
      }
      return next;
    });
  };

  const widgets = [
    {
      id: "characters",
      icon: <LuUsers />,
      label: "Characters",
      description: "Manage characters",
    },
    {
      id: "scene",
      icon: <LuPalette />,
      label: "Scene",
      description: "Environment & atmosphere",
    },
    {
      id: "director",
      icon: <LuClapperboard />,
      label: "Director",
      description: "Generation settings",
    },
    {
      id: "settings",
      icon: <LuSettings2 />,
      label: "Tools",
      description: "Chapter management",
    },
  ];

  return (
    <Flex
      direction="column"
      w={expanded ? "240px" : "60px"}
      bg="surface"
      transition="width 0.2s"
      flexShrink={0}
    >
      {/* Sidebar Header with Collapse Toggle */}
      <Flex
        h="14"
        px={expanded ? 4 : 2}
        align="center"
        justify={expanded ? "space-between" : "center"}
      >
        {expanded && (
          <Text fontSize="sm" fontWeight="medium">
            Widgets
          </Text>
        )}
        {onToggle && (
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onToggle}
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {expanded ? <LuChevronLeft /> : <LuChevronRight />}
          </IconButton>
        )}
      </Flex>

      {/* Widget Toggles */}
      <Stack p={expanded ? 3 : 2} gap={2}>
        {widgets.map((widget) => (
          <WidgetToggle
            key={widget.id}
            icon={widget.icon}
            label={widget.label}
            isActive={activeWidgets.has(widget.id)}
            onClick={() => toggleWidget(widget.id)}
            collapsed={!expanded}
          />
        ))}
      </Stack>

      {/* Widget Panels (only shown when expanded) */}
      {expanded && (
        <WidgetPanels activeWidgets={activeWidgets} characters={characters} />
      )}
    </Flex>
  );
}
