import {
  Box,
  Combobox,
  InputGroup,
  Portal,
  Spinner,
  Text,
  useCombobox,
  useListCollection,
} from "@chakra-ui/react";
import type React from "react";
import { Fragment, useEffect, useMemo, useRef } from "react";
import { Avatar } from "@/components/ui/index";
import { useCharacterSearch } from "@/features/characters/hooks/use-character-search";
import { getApiUrl } from "@/lib/trpc";
import { CharacterListItem } from "./character-list-item";

type CharacterSearchCharacter = ReturnType<typeof useCharacterSearch>["characters"][number];

/**
 * Shared hook that wires Chakra v3 Combobox collection to TRPC search.
 * Uses `useListCollection` so we can push async results efficiently as they arrive.
 */
function useCharacterCollection(
  enabled: boolean,
  filterMode?: "all" | "inScenario" | "notInScenario",
  scenarioId?: string
) {
  const { characters, isLoading, updateSearch, searchQuery } = useCharacterSearch({
    enabled,
    filterMode,
    scenarioId,
  });

  const { collection, set } = useListCollection<CharacterSearchCharacter>({
    initialItems: [],
    itemToString: (c) => c.name,
    itemToValue: (c) => c.id,
  });

  // push new results into Combobox collection whenever TRPC data changes
  useEffect(() => {
    set(characters);
  }, [characters, set]);

  return { collection, isLoading, updateSearch, searchQuery };
}

/**
 * MULTI SELECT
 * - `multiple` is enabled so the input clears after each pick (Chakra behavior)
 * - Parent controls the chips/portraits elsewhere; we only maintain selection state
 */
export function CharacterMultiSelect({
  value,
  onChange,
  filterMode = "all",
  scenarioId,
  placeholder = "Search characters…",
  disabled = false,
  size = "md",
  layerStyle = "surface",
  inDialog = false,
  hideClearTrigger = false,
  ...props
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  filterMode?: "all" | "inScenario" | "notInScenario";
  scenarioId?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  layerStyle?: string;
  /** If true, omits Portal so the dropdown appears within the dialog */
  inDialog?: boolean;
  /** Hides the clear trigger button in case the parent handles clearing */
  hideClearTrigger?: boolean;
} & Omit<Combobox.RootProps, "value" | "onValueChange" | "collection" | "onChange">) {
  const { collection, isLoading, updateSearch } = useCharacterCollection(
    !disabled,
    filterMode,
    scenarioId
  );

  const handleValueChange = (details: Combobox.ValueChangeDetails) => {
    onChange(details.value);
  };

  const PortalComponent = inDialog ? Fragment : Portal;

  return (
    <Combobox.Root
      multiple
      closeOnSelect
      value={value}
      collection={collection}
      onValueChange={handleValueChange}
      onInputValueChange={(e) => updateSearch(e.inputValue)}
      width="full"
      size={size}
      disabled={disabled}
      inputBehavior="autohighlight"
      {...props}
    >
      <Combobox.Control>
        <InputGroup>
          <Combobox.Input placeholder={placeholder} />
        </InputGroup>
        <Combobox.IndicatorGroup>
          {isLoading && <Spinner size="xs" />}
          {/* Clear resets to empty array for the parent */}
          {!hideClearTrigger && <Combobox.ClearTrigger />}
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>

      <PortalComponent>
        <Combobox.Positioner>
          <Combobox.Content>
            <Combobox.Empty>
              <Text color="content.muted" fontSize="sm" px={3} py={2}>
                No characters found
              </Text>
            </Combobox.Empty>
            {collection.items.map((character) => (
              <Combobox.Item key={character.id} item={character}>
                <CharacterListItem character={character} size={size} layerStyle={layerStyle} />
                <Combobox.ItemIndicator />
              </Combobox.Item>
            ))}
          </Combobox.Content>
        </Combobox.Positioner>
      </PortalComponent>
    </Combobox.Root>
  );
}

/**
 * SINGLE SELECT
 * - keeps the chosen value in the input; prevents further selections
 * - shows the avatar of the selected character inside the input
 */
export function CharacterSingleSelect({
  value,
  onChange,
  filterMode = "all",
  scenarioId,
  placeholder = "Search characters…",
  disabled = false,
  size = "md",
  inDialog = false,
  layerStyle = "surface",
  ...props
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  filterMode?: "all" | "inScenario" | "notInScenario";
  scenarioId?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  /** If true, omits Portal so the dropdown appears within the dialog */
  inDialog?: boolean;
  layerStyle?: string;
} & Omit<Combobox.RootProviderProps, "value" | "onValueChange" | "collection" | "onChange">) {
  const { collection, isLoading, updateSearch } = useCharacterCollection(
    !disabled,
    filterMode,
    scenarioId
  );

  const internalValue = useMemo(() => (value ? [value] : []), [value]);

  const combobox = useCombobox({
    collection,
    disabled,
    // defaultValue: defaultValue ? [defaultValue] : [],
    placeholder,
    inputBehavior: "autohighlight",
    value: internalValue,
    onValueChange: (e) => onChange(e.value[0] ?? null),
    onInputValueChange: (e) => updateSearch(e.inputValue),
  });

  // Rehydrate once items arrive
  const hydratedRef = useRef(false);

  if (combobox.value.length && collection.size && !hydratedRef.current) {
    combobox.syncSelectedItems();
    hydratedRef.current = true;
  }

  const selectedCharacter = useMemo(() => {
    if (!value) return null;
    return collection.items.find((c) => c.id === value) ?? null;
  }, [value, collection.items]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Backspace" || e.key === "Delete") && combobox.value.length) {
      combobox.setValue([]);
      combobox.setInputValue("");
      onChange(null);
      e.preventDefault();
    }
    if (e.key === "Escape" && combobox.value.length) {
      combobox.setValue([]);
      combobox.setInputValue("");
      onChange(null);
      e.preventDefault();
    }
  };

  const PortalComponent = inDialog ? Fragment : Portal;

  return (
    <Combobox.RootProvider value={combobox} width="full" size={size} {...props}>
      <Combobox.Control>
        <InputGroup
          startOffset={selectedCharacter ? "-0rem" : undefined}
          startElement={
            selectedCharacter && (
              <Box ml={-2} display="flex" alignItems="center">
                <Avatar
                  shape="rounded"
                  size={size === "lg" ? "sm" : "xs"}
                  layerStyle={layerStyle}
                  name={selectedCharacter.name}
                  src={
                    selectedCharacter.avatarPath
                      ? getApiUrl(selectedCharacter.avatarPath)
                      : undefined
                  }
                />
              </Box>
            )
          }
        >
          <Combobox.Input onKeyDown={onKeyDown} />
        </InputGroup>
        <Combobox.IndicatorGroup>
          {isLoading && <Spinner size="xs" />}
          {/* Clear resets to null for the parent */}
          <Combobox.ClearTrigger onClick={() => onChange(null)} />
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>

      <PortalComponent>
        <Combobox.Positioner>
          <Combobox.Content>
            <Combobox.Empty>
              <Text color="content.muted" fontSize="sm" px={3} py={2}>
                No characters found
              </Text>
            </Combobox.Empty>
            {collection.items.map((character) => (
              <Combobox.Item key={character.id} item={character}>
                <CharacterListItem character={character} size={size} layerStyle={layerStyle} />
                <Combobox.ItemIndicator />
              </Combobox.Item>
            ))}
          </Combobox.Content>
        </Combobox.Positioner>
      </PortalComponent>
    </Combobox.RootProvider>
  );
}
