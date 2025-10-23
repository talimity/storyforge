import { IconButton, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import type { CardType } from "@storyforge/contracts";
import { cardTypeSchema } from "@storyforge/contracts";
import { LuFilter } from "react-icons/lu";
import { Button, Checkbox, Switch } from "@/components/ui";
import { cardTypeLabels } from "@/features/characters/character-enums";

interface CharacterFilterContentProps {
  actorTypes: CardType[];
  starredOnly: boolean;
  onActorTypesChange: (next: CardType[]) => void;
  onStarredOnlyChange: (next: boolean) => void;
  isDirty: boolean;
  onClear?: () => void;
}

export function CharacterFilterContent(props: CharacterFilterContentProps) {
  const { actorTypes, starredOnly, onActorTypesChange, onStarredOnlyChange, isDirty, onClear } =
    props;

  const handleActorTypeToggle = (type: CardType, checked: boolean) => {
    if (checked) {
      if (actorTypes.includes(type)) {
        return;
      }
      onActorTypesChange([...actorTypes, type]);
    } else {
      const next = actorTypes.filter((value) => value !== type);
      onActorTypesChange(next);
    }
  };

  return (
    <Stack gap={4}>
      <Stack gap={2}>
        <Text fontSize="sm" fontWeight="semibold">
          Actor Type
        </Text>
        <Stack gap={1}>
          {Object.entries(cardTypeLabels).map(([value, label]) => {
            const parsedType = cardTypeSchema.safeParse(value);
            if (!parsedType.success) {
              return null;
            }
            const type = parsedType.data;
            const isChecked = actorTypes.includes(type);
            return (
              <Checkbox
                key={value}
                colorPalette="primary"
                checked={isChecked}
                onCheckedChange={(event) => {
                  const nextChecked = Boolean(event.checked);
                  handleActorTypeToggle(type, nextChecked);
                }}
              >
                {label}
              </Checkbox>
            );
          })}
        </Stack>
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

export interface CharacterFilterPopoverProps extends CharacterFilterContentProps {}

export function CharacterFilterPopover(props: CharacterFilterPopoverProps) {
  const { isDirty, ...contentProps } = props;

  return (
    <Popover.Root lazyMount unmountOnExit positioning={{ placement: "bottom-start" }}>
      <Popover.Trigger asChild>
        <IconButton
          aria-label="Filter characters"
          variant={isDirty ? "solid" : "outline"}
          colorPalette={isDirty ? "accent" : "neutral"}
          size="sm"
          boxSize="10"
        >
          <LuFilter />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content minW="260px">
            <Popover.Arrow />
            <Popover.Body>
              <CharacterFilterContent isDirty={isDirty} {...contentProps} />
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
