import {
  Box,
  Checkbox,
  Fieldset,
  Flex,
  Heading,
  HStack,
  IconButton,
  Popover,
  Portal,
  SegmentGroup,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuSettings } from "react-icons/lu";
import { ColorModeToggle } from "@/components/color-mode-toggle";
import { Field } from "@/components/ui/index";
import {
  FONT_SIZE_OPTIONS,
  isFontSizeOption,
  isTimelineWidthOption,
  PINNABLE_TURN_ACTIONS,
  type PinnableTurnAction,
  selectFontSize,
  selectPinnedQuickActions,
  selectSetFontSize,
  selectSetTimelineWidth,
  selectTimelineWidth,
  selectTogglePinnedQuickAction,
  TIMELINE_WIDTH_OPTIONS,
  usePlayerPreferencesStore,
} from "@/features/scenario-player/stores/player-preferences-store";

export function PlayerMetaMenu() {
  return (
    <Popover.Root positioning={{ placement: "bottom", gutter: 4 }} lazyMount unmountOnExit>
      <Popover.Trigger asChild>
        <IconButton variant="ghost" size="sm" aria-label="Scenario player options">
          <LuSettings />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="auto">
            <Popover.Arrow />
            <Popover.Header>
              <HStack>
                <Heading size="md" textStyle="heading">
                  Preferences
                </Heading>
                <Box maxW="10" ml="auto">
                  <ColorModeToggle collapsed />
                </Box>
              </HStack>
            </Popover.Header>
            <Popover.Body>
              <Stack gap={4}>
                <FontSizeSelector />

                <TurnHistoryWidthSelector />

                <QuickActionSelector />
              </Stack>
            </Popover.Body>
            <Popover.CloseTrigger />
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

function FontSizeSelector() {
  const fontSize = usePlayerPreferencesStore(selectFontSize);
  const setFontSize = usePlayerPreferencesStore(selectSetFontSize);

  return (
    <Field label="Timeline Text Size" helperText="Adjust the text size of turns in the timeline.">
      <Flex w="100%" justify="start" gap={4}>
        <SegmentGroup.Root
          size="sm"
          value={fontSize}
          onValueChange={(event) => {
            const { value } = event;
            if (value !== null && isFontSizeOption(value)) {
              setFontSize(value);
            }
          }}
        >
          <SegmentGroup.Items items={Array.from(FONT_SIZE_OPTIONS)} />
          <SegmentGroup.Indicator />
        </SegmentGroup.Root>
      </Flex>
    </Field>
  );
}

function TurnHistoryWidthSelector() {
  const timelineWidth = usePlayerPreferencesStore(selectTimelineWidth);
  const setTimelineWidth = usePlayerPreferencesStore(selectSetTimelineWidth);

  return (
    <Field
      label="Timeline Width"
      helperText="Adjust the display width of the timeline."
      hideBelow="sm"
    >
      <Flex w="100%" justify="start" gap={4}>
        <SegmentGroup.Root
          size="sm"
          value={timelineWidth}
          onValueChange={(event) => {
            const { value } = event;
            if (value !== null && isTimelineWidthOption(value)) {
              setTimelineWidth(value);
            }
          }}
        >
          <SegmentGroup.Items items={Array.from(TIMELINE_WIDTH_OPTIONS)} />
          <SegmentGroup.Indicator />
        </SegmentGroup.Root>
      </Flex>
    </Field>
  );
}

interface QuickActionOption {
  value: PinnableTurnAction;
  label: string;
}

const QUICK_ACTION_DETAILS: Record<PinnableTurnAction, { label: string }> = {
  edit: { label: "Edit turn" },
  retry: { label: "Retry turn" },
  delete: { label: "Delete turn" },
  "generation-info": { label: "Generation info" },
};

const QUICK_ACTION_OPTIONS: QuickActionOption[] = PINNABLE_TURN_ACTIONS.map((value) => ({
  value,
  label: QUICK_ACTION_DETAILS[value].label,
}));

function QuickActionSelector() {
  const pinnedQuickActions = usePlayerPreferencesStore(selectPinnedQuickActions);
  const togglePinnedQuickAction = usePlayerPreferencesStore(selectTogglePinnedQuickAction);

  return (
    <Fieldset.Root>
      <Fieldset.Legend>
        <Text>Quick Turn Actions</Text>
        <Text fontSize="xs" color="content.muted">
          Choose which actions stay visible next to each turn.
        </Text>
      </Fieldset.Legend>
      <Fieldset.Content mt={1}>
        <Stack align="flex-start">
          {QUICK_ACTION_OPTIONS.map((option) => {
            const isChecked = pinnedQuickActions.includes(option.value);
            return (
              <Checkbox.Root
                key={option.value}
                checked={isChecked}
                onCheckedChange={(event) => {
                  console.log(option.value, event.checked);
                  togglePinnedQuickAction(option.value, Boolean(event.checked));
                }}
                colorPalette="neutral"
                size="sm"
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
                <Checkbox.Label>{option.label}</Checkbox.Label>
              </Checkbox.Root>
            );
          })}
        </Stack>
      </Fieldset.Content>
    </Fieldset.Root>
  );
}
