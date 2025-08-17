import { Box, Flex, Heading, IconButton, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuClapperboard,
  LuPalette,
  LuSettings2,
  LuUsers,
} from "react-icons/lu";
import { CompactCharacterCard } from "@/components/features/character/compact-character-card";
import { Button } from "@/components/ui";
import { useScenarioPlayerStore } from "@/stores/scenario-store";

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
  // Get client state only from the store
  const { selectedCharacterId, setSelectedCharacter } =
    useScenarioPlayerStore();

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
      {expanded && activeWidgets.size > 0 && (
        <Box
          flex="1"
          overflow="auto"
          borderTopWidth="1px"
          borderColor="border.subtle"
        >
          <Stack p={3} gap={4}>
            {activeWidgets.has("characters") && (
              <Box>
                <Heading size="xs" color="content.muted" mb={3}>
                  Characters ({characters.length})
                </Heading>
                {characters.length > 0 ? (
                  <Stack gap={2}>
                    {characters.map((character) => (
                      <CompactCharacterCard
                        key={character.id}
                        character={{
                          id: character.id,
                          name: character.name,
                          cardType: "character" as const,
                          avatarPath: character.avatarPath,
                        }}
                        isSelected={selectedCharacterId === character.id}
                        onSelectionToggle={() => {
                          setSelectedCharacter(
                            selectedCharacterId === character.id
                              ? null
                              : character.id
                          );
                        }}
                      />
                    ))}
                  </Stack>
                ) : (
                  <Text fontSize="xs" color="content.muted">
                    No characters in this scenario
                  </Text>
                )}
              </Box>
            )}
            {activeWidgets.has("scene") && (
              <Box>
                <Text fontSize="xs" fontWeight="semibold" mb={2}>
                  SCENE
                </Text>
                <Text fontSize="xs" color="content.muted">
                  Scene controls will appear here
                </Text>
              </Box>
            )}
            {activeWidgets.has("director") && (
              <Box>
                <Text fontSize="xs" fontWeight="semibold" mb={2}>
                  DIRECTOR
                </Text>
                <Text fontSize="xs" color="content.muted">
                  Generation settings will appear here
                </Text>
              </Box>
            )}
            {activeWidgets.has("settings") && (
              <Box>
                <Text fontSize="xs" fontWeight="semibold" mb={2}>
                  TOOLS
                </Text>
                <Text fontSize="xs" color="content.muted">
                  Chapter management will appear here
                </Text>
              </Box>
            )}
          </Stack>
        </Box>
      )}
    </Flex>
  );
}
