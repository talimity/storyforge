import { Combobox, InputGroup, Portal, Spinner, Text, useCombobox } from "@chakra-ui/react";
import { Fragment } from "react";
import { useScenarioSearch } from "@/features/scenarios/hooks/use-scenario-search";
import {
  useAsyncComboboxCollection,
  useComboboxSelectionHydrator,
} from "@/hooks/use-async-combobox";

type ScenarioItem = ReturnType<typeof useScenarioSearch>["scenarios"][number];

function useScenarioCollection(enabled: boolean, status?: "active" | "archived") {
  const { scenarios, isLoading, updateSearch, searchQuery } = useScenarioSearch({
    enabled,
    status,
  });
  const collection = useAsyncComboboxCollection<ScenarioItem>({
    items: scenarios,
    itemToString: (scenario: ScenarioItem) => scenario.name,
    itemToValue: (scenario: ScenarioItem) => scenario.id,
  });
  return { collection, isLoading, updateSearch, searchQuery };
}

export function ScenarioSingleSelect({
  value,
  onChange,
  placeholder = "Search scenarios…",
  disabled = false,
  size = "md",
  inDialog = false,
  status,
  ...props
}: {
  value?: string | null;
  onChange: (id?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  inDialog?: boolean;
  status?: "active" | "archived";
} & Omit<Combobox.RootProviderProps, "value" | "onValueChange" | "collection" | "onChange">) {
  const { collection, isLoading, updateSearch } = useScenarioCollection(!disabled, status);
  const combobox = useCombobox({
    collection,
    disabled,
    placeholder,
    inputBehavior: "autohighlight",
    value: value ? [value] : [],
    onValueChange: (e) => onChange(e.value[0]),
    onInputValueChange: (e) => updateSearch(e.inputValue),
  });

  useComboboxSelectionHydrator(combobox);

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
                No scenarios found
              </Text>
            </Combobox.Empty>
            {collection.items.map((scenario) => (
              <Combobox.Item key={scenario.id} item={scenario}>
                {scenario.name}
                <Combobox.ItemIndicator />
              </Combobox.Item>
            ))}
          </Combobox.Content>
        </Combobox.Positioner>
      </PortalComponent>
    </Combobox.RootProvider>
  );
}
