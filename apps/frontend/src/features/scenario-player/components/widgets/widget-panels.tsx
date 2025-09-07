import { Box, Stack } from "@chakra-ui/react";
import { memo } from "react";
import { CharactersWidget } from "./characters-widget";
import { DirectorWidget } from "./director-widget";
import { SceneWidget } from "./scene-widget";
import { ToolsWidget } from "./tools-widget";

interface Character {
  id: string;
  name: string;
  avatarPath: string | null;
}

interface WidgetPanelsProps {
  activeWidgets: Set<string>;
  characters: Character[];
}

export const WidgetPanels = memo(function WidgetPanels({
  activeWidgets,
  characters,
}: WidgetPanelsProps) {
  if (activeWidgets.size === 0) {
    return null;
  }

  return (
    <Box flex="1" overflow="auto" borderTopWidth="1px" borderColor="border.subtle">
      <Stack p={3} gap={4}>
        {activeWidgets.has("characters") && <CharactersWidget characters={characters} />}
        {activeWidgets.has("scene") && <SceneWidget />}
        {activeWidgets.has("director") && <DirectorWidget />}
        {activeWidgets.has("settings") && <ToolsWidget />}
      </Stack>
    </Box>
  );
});
