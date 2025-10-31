import { Combobox, InputGroup, Portal, Spinner, Text, useCombobox } from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/gentasks";
import { Fragment } from "react";
import { useTemplateSearch } from "@/features/templates/hooks/use-template-search";
import {
  useAsyncComboboxCollection,
  useComboboxSelectionHydrator,
} from "@/hooks/use-async-combobox";

type TemplateItem = ReturnType<typeof useTemplateSearch>["templates"][number];

function useTemplateCollection(enabled: boolean, task?: TaskKind) {
  const { templates, isLoading, updateSearch } = useTemplateSearch({ enabled, task });
  const collection = useAsyncComboboxCollection<TemplateItem>({
    items: templates,
    itemToString: (template: TemplateItem) => template.name,
    itemToValue: (template: TemplateItem) => template.id,
  });
  return { collection, isLoading, updateSearch };
}

export function TemplateSingleSelect({
  value,
  onChange,
  task,
  placeholder = "Search templates…",
  disabled = false,
  size = "md",
  inDialog = false,
  ...props
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  task?: TaskKind;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  inDialog?: boolean;
} & Omit<Combobox.RootProviderProps, "value" | "onValueChange" | "collection" | "onChange">) {
  const { collection, isLoading, updateSearch } = useTemplateCollection(!disabled, task);
  const combobox = useCombobox({
    collection,
    disabled,
    placeholder,
    inputBehavior: "autohighlight",
    value: value ? [value] : [],
    onValueChange: (e) => onChange(e.value[0] ?? null),
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
          <Combobox.ClearTrigger onClick={() => onChange(null)} />
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <PortalComponent>
        <Combobox.Positioner>
          <Combobox.Content>
            <Combobox.Empty>
              <Text color="content.muted" fontSize="sm" px={3} py={2}>
                No templates found
              </Text>
            </Combobox.Empty>
            {collection.items.map((t) => (
              <Combobox.Item key={t.id} item={t}>
                <Text>{t.name}</Text>
                <Text fontSize="xs" color="content.muted">
                  v{t.version}
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
