"use client";

import {
  createListCollection,
  IconButton,
  type SelectRootProps,
  useSelectContext,
} from "@chakra-ui/react";
import type { CharacterSummary } from "@storyforge/contracts";
import { useMemo } from "react";
import { RiForbidLine } from "react-icons/ri";
import { Avatar, type AvatarProps } from "@/components/ui/avatar";
import { SelectContent, SelectItem, SelectRoot } from "@/components/ui/select";
import { CharacterListItem } from "@/features/characters/components/character-list-item";
import { getApiUrl } from "@/lib/get-api-url";

type CharacterMiniSelectCharacter = Pick<CharacterSummary, "id" | "name" | "avatarPath"> & {
  imagePath?: string | null;
};

interface CharacterOption {
  value: string;
  label: string;
  avatarUrl: string | null;
  character: CharacterMiniSelectCharacter;
}

type CharacterMiniSelectProps = {
  characters: CharacterMiniSelectCharacter[];
  value: string | null;
  onChange: (characterId: string | null) => void;
  disabled?: boolean;
  portalled?: boolean;
} & Omit<SelectRootProps & AvatarProps, "value" | "onChange" | "collection">;

interface CharacterMiniSelectTriggerProps extends AvatarProps {
  optionByValue: Map<string, CharacterOption>;
  disabled?: boolean;
}

const CharacterMiniSelectTrigger = ({
  optionByValue,
  disabled = false,
  boxSize,
  size,
  ...rest
}: CharacterMiniSelectTriggerProps) => {
  const select = useSelectContext();
  const selectedValue = select.value[0];
  const option = selectedValue ? (optionByValue.get(selectedValue) ?? null) : null;
  const avatarName = option?.character.name ?? "";
  const avatarUrl = option?.avatarUrl ?? null;
  const label = option ? `Speaking as ${option.character.name}` : "Select a character";

  return (
    <IconButton
      aria-label={label}
      title={label}
      variant="plain"
      disabled={disabled}
      {...select.getTriggerProps()}
    >
      {option ? (
        <Avatar
          shape="rounded"
          name={avatarName}
          src={avatarUrl}
          size={size}
          boxSize={boxSize}
          {...rest}
        />
      ) : (
        <RiForbidLine />
      )}
    </IconButton>
  );
};

export function CharacterMiniSelect(props: CharacterMiniSelectProps) {
  const {
    characters,
    value,
    onChange,
    disabled = false,
    layerStyle = "surface",
    portalled = true,
    size,
    boxSize = "40px",
    ...rest
  } = props;
  const items = useMemo<CharacterOption[]>(
    () =>
      characters.map((character) => ({
        value: character.id,
        label: character.name,
        avatarUrl: getApiUrl(character.avatarPath),
        character,
      })),
    [characters]
  );
  const optionByValue = useMemo(() => new Map(items.map((item) => [item.value, item])), [items]);
  const collection = useMemo(() => createListCollection({ items }), [items]);

  return (
    <SelectRoot
      collection={collection}
      positioning={{ sameWidth: false }}
      value={value ? [value] : []}
      onValueChange={(details) => onChange(details.value[0] ?? null)}
      disabled={disabled}
      maxW={boxSize}
      {...rest}
    >
      <CharacterMiniSelectTrigger
        optionByValue={optionByValue}
        disabled={disabled}
        size={size}
        boxSize={boxSize}
        layerStyle={layerStyle}
      />
      <SelectContent minW="40" portalled={portalled}>
        {items.map((item) => (
          <SelectItem key={item.value} item={item}>
            <CharacterListItem character={item.character} size="md" layerStyle={layerStyle} />
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}
