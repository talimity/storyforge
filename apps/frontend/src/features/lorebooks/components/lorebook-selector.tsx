import { Combobox, InputGroup, Portal, Spinner, Text, useListCollection } from "@chakra-ui/react";
import { Fragment, useEffect } from "react";
import { useLorebookSearch } from "@/features/lorebooks/hooks/use-lorebook-search";

export type LorebookSelectItem = ReturnType<typeof useLorebookSearch>["lorebooks"][number];

interface LorebookMultiSelectProps {
  onSelect: (items: LorebookSelectItem[]) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  inDialog?: boolean;
}

export function LorebookMultiSelect({
  onSelect,
  placeholder = "Search lorebooks…",
  disabled = false,
  size = "md",
  inDialog = false,
}: LorebookMultiSelectProps) {
  const { lorebooks, isLoading, updateSearch } = useLorebookSearch({ enabled: !disabled });

  const { collection, set } = useListCollection<LorebookSelectItem>({
    initialItems: [],
    itemToString: (item) => item.name,
    itemToValue: (item) => item.id,
  });

  useEffect(() => {
    set(lorebooks);
  }, [lorebooks, set]);

  const PortalComponent = inDialog ? Fragment : Portal;

  return (
    <Combobox.Root
      multiple
      closeOnSelect
      value={[]}
      collection={collection}
      onValueChange={(details) => {
        const items = details.value
          .map((id) => collection.items.find((item) => item.id === id))
          .filter((item): item is LorebookSelectItem => Boolean(item));
        if (items.length > 0) {
          onSelect(items);
        }
      }}
      onInputValueChange={(details) => updateSearch(details.inputValue)}
      width="full"
      size={size}
      disabled={disabled}
      inputBehavior="autohighlight"
    >
      <Combobox.Control>
        <InputGroup>
          <Combobox.Input placeholder={placeholder} />
        </InputGroup>
        <Combobox.IndicatorGroup>
          {isLoading && <Spinner size="xs" />}
          <Combobox.ClearTrigger onClick={() => onSelect([])} />
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>

      <PortalComponent>
        <Combobox.Positioner>
          <Combobox.Content>
            <Combobox.Empty>
              <Text color="content.muted" fontSize="sm" px={3} py={2}>
                No lorebooks found
              </Text>
            </Combobox.Empty>
            {collection.items.map((item) => (
              <Combobox.Item key={item.id} item={item}>
                <Text fontWeight="medium">{item.name}</Text>
                <Text color="content.muted" fontSize="xs">
                  {item.entryCount} entries
                </Text>
                <Combobox.ItemIndicator />
              </Combobox.Item>
            ))}
          </Combobox.Content>
        </Combobox.Positioner>
      </PortalComponent>
    </Combobox.Root>
  );
}
