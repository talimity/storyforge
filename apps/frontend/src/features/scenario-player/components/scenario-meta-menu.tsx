import {
  Box,
  Flex,
  Heading,
  HStack,
  IconButton,
  Popover,
  Portal,
  SegmentGroup,
  Stack,
} from "@chakra-ui/react";
import { useState } from "react";
import { LuSettings } from "react-icons/lu";
import { ColorModeToggle } from "@/components/color-mode-toggle";
import { Field } from "@/components/ui/index";

export function ScenarioMetaMenu() {
  return (
    <Popover.Root positioning={{ placement: "bottom", gutter: 4 }} lazyMount unmountOnExit>
      <Popover.Trigger asChild>
        <IconButton variant="ghost" size="sm" aria-label="Scenario player options">
          <LuSettings />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Arrow />
            <Popover.Header>
              <HStack>
                <Heading size="md" textStyle="heading">
                  Preferences
                </Heading>
                <Box maxW="40px" ml="auto">
                  <ColorModeToggle collapsed />
                </Box>
              </HStack>
            </Popover.Header>
            <Popover.Body>
              <Stack gap={4} minW="240px">
                <FontSizeSelector />

                <TurnHistoryWidthSelector />
              </Stack>
            </Popover.Body>
            <Popover.CloseTrigger />
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

type FontSizeOption = "sm" | "md" | "lg";
function FontSizeSelector() {
  const [fontSize, setFontSize] = useLocalStorageState<FontSizeOption>("scenario-font-size", "md");

  return (
    <Field label="Text Size" helperText="Adjust the size of the scenario text.">
      <Flex w="100%" justify="center" gap={4}>
        <SegmentGroup.Root
          size="sm"
          value={fontSize}
          onValueChange={(e) => setFontSize(e.value as FontSizeOption)}
        >
          <SegmentGroup.Items items={["sm", "md", "lg"]} />
          <SegmentGroup.Indicator />
        </SegmentGroup.Root>
      </Flex>
    </Field>
  );
}

type TurnHistoryWidthOption = "sm" | "md" | "lg" | "xl" | "full";
function TurnHistoryWidthSelector() {
  const [width, setWidth] = useLocalStorageState<TurnHistoryWidthOption>(
    "scenario-turn-history-width",
    "lg"
  );

  return (
    <Field label="Timeline Width" helperText="Adjust the width of the scenario timeline.">
      <Flex w="100%" justify="center" gap={4}>
        <SegmentGroup.Root
          size="sm"
          value={width}
          onValueChange={(e) => setWidth(e.value as TurnHistoryWidthOption)}
        >
          <SegmentGroup.Items items={["sm", "md", "lg", "xl", "full"]} />
          <SegmentGroup.Indicator />
        </SegmentGroup.Root>
      </Flex>
    </Field>
  );
}

function useLocalStorageState<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    const storedValue = localStorage.getItem(key);
    return storedValue ? (JSON.parse(storedValue) as T) : defaultValue;
  });

  const setLocalStorageState = (value: T) => {
    setState(value);
    localStorage.setItem(key, JSON.stringify(value));
  };

  return [state, setLocalStorageState];
}
