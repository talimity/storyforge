import {
  Combobox,
  InputGroup,
  Portal,
  Spinner,
  Text,
  useCombobox,
  useListCollection,
} from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/gentasks";
import { Fragment, useEffect, useMemo, useRef } from "react";
import { useTemplateSearch } from "@/features/templates/hooks/use-template-search";

type TemplateItem = ReturnType<typeof useTemplateSearch>["templates"][number];

function useTemplateCollection(enabled: boolean, task?: TaskKind) {
  const { templates, isLoading, updateSearch } = useTemplateSearch({ enabled, task });
  const { collection, set } = useListCollection<TemplateItem>({
    initialItems: [],
    itemToString: (t) => t.name,
    itemToValue: (t) => t.id,
  });
  useEffect(() => {
    set(templates);
  }, [templates, set]);
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
  const internalValue = useMemo(() => (value ? [value] : []), [value]);
  const combobox = useCombobox({
    collection,
    disabled,
    placeholder,
    inputBehavior: "autohighlight",
    value: internalValue,
    onValueChange: (e) => onChange(e.value[0] ?? null),
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
