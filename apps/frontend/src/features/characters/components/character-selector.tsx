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
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { Fragment, useEffect, useRef } from "react";
import { Avatar } from "@/components/ui";
import { useCharacterSearch } from "@/features/characters/hooks/use-character-search";
import { getApiUrl } from "@/lib/get-api-url";
import { useTRPC } from "@/lib/trpc";
import { CharacterListItem } from "./character-list-item";

type CharacterSearchCharacter = ReturnType<typeof useCharacterSearch>["characters"][number];

/**
 * Shared hook that wires Chakra v3 Combobox collection to TRPC search.
 * Uses `useListCollection` so we can push async results efficiently as they arrive.
 */
function useCharacterCollection(
  enabled: boolean,
  filterMode?: "all" | "inScenario" | "notInScenario",
  scenarioId?: string,
  requiredIds?: string[]
) {
  const { characters, isLoading, updateSearch, searchQuery } = useCharacterSearch({
    enabled,
    filterMode,
    scenarioId,
  });
  const trpc = useTRPC();

  const normalizedRequiredIds = (requiredIds ?? []).filter((id) => id.length > 0);

  // Fetch any missing required characters
  const presentIds = new Set(characters.map((character) => character.id));
  const missingRequiredIds = normalizedRequiredIds.filter((id) => !presentIds.has(id));
  const requiredCharactersQuery = useQuery(
    trpc.characters.getByIds.queryOptions(
      { ids: missingRequiredIds },
      { enabled: enabled && missingRequiredIds.length > 0 }
    )
  );

  const requiredCharacters = (requiredCharactersQuery.data?.characters ?? []).map((character) => ({
    id: character.id,
    name: character.name,
    cardType: character.cardType,
    imagePath: character.imagePath,
    avatarPath: character.avatarPath,
  }));

  const combinedCharacters = getCombinedCharacters(characters, requiredCharacters);

  const { collection, set } = useListCollection<CharacterSearchCharacter>({
    initialItems: [],
    itemToString: (c) => c.name,
    itemToValue: (c) => c.id,
  });

  // push new results into Combobox collection whenever TRPC data changes
  useEffect(() => {
    set(combinedCharacters);
  }, [combinedCharacters, set]);

  return {
    collection,
    isLoading: isLoading || requiredCharactersQuery.isLoading,
    updateSearch,
    searchQuery,
  };
}

function getCombinedCharacters(
  characters: CharacterSearchCharacter[],
  requiredCharacters: CharacterSearchCharacter[]
) {
  if (requiredCharacters.length === 0) return characters;
  const existingIds = new Set(characters.map((character) => character.id));
  const extras = requiredCharacters.filter((character) => !existingIds.has(character.id));
  if (extras.length === 0) return characters;
  return [...characters, ...extras];
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
    scenarioId,
    value
  );

  const PortalComponent = inDialog ? Fragment : Portal;

  return (
    <Combobox.Root
      multiple
      closeOnSelect
      value={value}
      collection={collection}
      onValueChange={(details) => onChange(details.value)}
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
    scenarioId,
    value ? [value] : []
  );

  const internalValue = value ? [value] : [];

  const combobox = useCombobox({
    collection,
    disabled,
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

  const selectedCharacter = collection.items.find((c) => c.id === value) ?? null;

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
