import type { useCombobox } from "@chakra-ui/react";
import { type CollectionItem, type ListCollection, useListCollection } from "@chakra-ui/react";
import { useEffect, useRef } from "react";

type UseAsyncComboboxCollectionOptions<T extends CollectionItem> = {
  items: readonly T[];
  itemToString: (item: T) => string;
  itemToValue: (item: T) => string;
};

/**
 * Creates a Chakra v3 Combobox collection that can be updated asynchronously.
 * Used for Comboboxes that fetch their items from an API based on user input.
 */
export function useAsyncComboboxCollection<T extends CollectionItem>(
  options: UseAsyncComboboxCollectionOptions<T>
): ListCollection<T> {
  const { items, itemToString, itemToValue } = options;
  const { collection, set } = useListCollection<T>({
    initialItems: [],
    itemToString,
    itemToValue,
  });

  useEffect(() => {
    set(Array.from(items));
  }, [items, set]);

  return collection;
}

type ComboboxApi<T extends CollectionItem> = ReturnType<typeof useCombobox<T>>;

/**
 * Hydrates the combobox's selected items from its values when the collection
 * updates. This is useful for async collections where the selected items may
 * not be present in the collection when the combobox is first initialized.
 */
export function useComboboxSelectionHydrator<T extends CollectionItem>(
  combobox: ComboboxApi<T>
): void {
  const { collection, value } = combobox;
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!collection || value.length === 0) {
      hydratedRef.current = false;
      return;
    }

    const canHydrate = value.every((selectedValue) => collection.has(selectedValue));
    if (!canHydrate) {
      hydratedRef.current = false;
      return;
    }

    if (hydratedRef.current) {
      return;
    }

    combobox.syncSelectedItems();
    hydratedRef.current = true;
  }, [combobox, collection, value]);
}
