import { HStack, IconButton, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { LuFilter } from "react-icons/lu";
import { Button, Switch } from "@/components/ui";

export type ScenarioStatusFilter = "all" | "active" | "archived";

const statusOptions: Array<{ value: ScenarioStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

interface ScenarioFilterContentProps {
  status: ScenarioStatusFilter;
  onStatusChange: (status: ScenarioStatusFilter) => void;
  starredOnly: boolean;
  onStarredOnlyChange: (next: boolean) => void;
  isDirty: boolean;
  onClear?: () => void;
}

export function ScenarioFilterContent(props: ScenarioFilterContentProps) {
  const { status, onStatusChange, starredOnly, onStarredOnlyChange, isDirty, onClear } = props;

  return (
    <Stack gap={4}>
      <Stack gap={2}>
        <Text fontSize="sm" fontWeight="semibold">
          Status
        </Text>
        <HStack gap={1} wrap="wrap">
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              size="xs"
              variant={status === option.value ? "solid" : "outline"}
              colorPalette={status === option.value ? "primary" : "neutral"}
              onClick={() => onStatusChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </HStack>
      </Stack>

      <Stack gap={1}>
        <Switch
          checked={starredOnly}
          onCheckedChange={(event) => onStarredOnlyChange(Boolean(event.checked))}
          colorPalette="accent"
        >
          Starred only
        </Switch>
      </Stack>

      {isDirty && onClear && (
        <Button size="sm" variant="ghost" onClick={onClear} alignSelf="flex-start">
          Clear filters
        </Button>
      )}
    </Stack>
  );
}

export interface ScenarioFilterPopoverProps extends ScenarioFilterContentProps {}

export function ScenarioFilterPopover(props: ScenarioFilterPopoverProps) {
  const { isDirty, ...contentProps } = props;

  return (
    <Popover.Root lazyMount unmountOnExit positioning={{ placement: "bottom-start" }}>
      <Popover.Trigger asChild>
        <IconButton
          aria-label="Filter scenarios"
          variant={isDirty ? "solid" : "outline"}
          colorPalette={isDirty ? "accent" : "neutral"}
          size="sm"
        >
          <LuFilter />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content minW="260px">
            <Popover.Arrow />
            <Popover.Body>
              <ScenarioFilterContent isDirty={isDirty} {...contentProps} />
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
