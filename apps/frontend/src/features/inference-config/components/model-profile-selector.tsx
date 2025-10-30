import {
  Combobox,
  InputGroup,
  Portal,
  Spinner,
  Text,
  useCombobox,
  useListCollection,
} from "@chakra-ui/react";
import { Fragment, useEffect, useMemo, useRef } from "react";
import { useModelProfileSearch } from "@/features/inference-config/hooks/use-model-profile-search";

type ModelProfileItem = ReturnType<typeof useModelProfileSearch>["modelProfiles"][number];

function useModelProfileCollection(enabled: boolean) {
  const { modelProfiles, isLoading, updateSearch } = useModelProfileSearch({
    enabled,
  });
  const { collection, set } = useListCollection<ModelProfileItem>({
    initialItems: [],
    itemToString: (p) => p.displayName,
    itemToValue: (p) => p.id,
  });
  useEffect(() => {
    set(modelProfiles);
  }, [modelProfiles, set]);
  return { collection, isLoading, updateSearch };
}

export function ModelProfileSingleSelect({
  value,
  onChange,
  placeholder = "Search model profiles…",
  disabled = false,
  size = "md",
  inDialog = false,
  ...props
}: {
  value?: string | null;
  onChange: (id?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  inDialog?: boolean;
} & Omit<Combobox.RootProviderProps, "value" | "onValueChange" | "collection" | "onChange">) {
  const { collection, isLoading, updateSearch } = useModelProfileCollection(!disabled);
  const internalValue = useMemo(() => (value ? [value] : []), [value]);
  const combobox = useCombobox({
    collection,
    disabled,
    placeholder,
    inputBehavior: "autohighlight",
    value: internalValue,
    onValueChange: (e) => onChange(e.value[0]),
    onInputValueChange: (e) => updateSearch(e.inputValue),
  });
  const hydratedRef = useRef(false);
  if (combobox.value.length && collection.size && !hydratedRef.current) {
    combobox.syncSelectedItems();
    hydratedRef.current = true;
  }
  const PortalComponent = inDialog ? Fragment : Portal;
  return (
    <Combobox.RootProvider value={combobox} width="full" size={size} {...props}>
      <Combobox.Control>
        <InputGroup>
          <Combobox.Input placeholder={placeholder} />
        </InputGroup>
        <Combobox.IndicatorGroup>
          {isLoading && <Spinner size="xs" />}
          <Combobox.ClearTrigger onClick={() => onChange(undefined)} />
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <PortalComponent>
        <Combobox.Positioner>
          <Combobox.Content>
            <Combobox.Empty>
              <Text color="content.muted" fontSize="sm" px={3} py={2}>
                No model profiles found
              </Text>
            </Combobox.Empty>
            {collection.items.map((p) => (
              <Combobox.Item key={p.id} item={p}>
                <Text>{p.displayName}</Text>
                <Text fontSize="xs" color="content.muted">
                  {p.modelId}
                </Text>
                <Combobox.ItemIndicator />
              </Combobox.Item>
            ))}
          </Combobox.Content>
        </Combobox.Positioner>
      </PortalComponent>
    </Combobox.RootProvider>
  );
}
