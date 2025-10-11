import { createListCollection, HStack, Input, Spinner, Text, VStack } from "@chakra-ui/react";
import type { ProviderConfig, SearchModelsOutput } from "@storyforge/contracts";
import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Button,
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui";
import { useAppForm } from "@/lib/app-form";
import { useTRPC } from "@/lib/trpc";
import { CapabilitiesSelector } from "./capabilities-selector";
import { JinjaTemplateDialog } from "./jinja-template-dialog";
import {
  type ModelProfileFormValues,
  modelProfileFormDefaultValues,
  modelProfileFormSchema,
} from "./model-profile-form-schemas";

interface ModelProfileFormProps {
  initialData?: Partial<ModelProfileFormValues>;
  onSubmit: (data: ModelProfileFormValues) => Promise<unknown> | unknown;
  onCancel: () => void;
  submitLabel?: string;
}

function ModelProfileForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Save Model Profile",
}: ModelProfileFormProps) {
  const trpc = useTRPC();

  const providersQuery = useQuery(trpc.providers.list.queryOptions());
  const providers = providersQuery.data?.providers ?? [];

  const initialValues = getInitialValues(initialData);
  const form = useAppForm({
    defaultValues: initialValues,
    validators: { onSubmit: modelProfileFormSchema },
    onSubmit: ({ value }) => onSubmit(value),
  });

  const formId = useId();

  useEffect(() => form.reset(initialValues), [form, initialValues]);

  const providerId = useStore(form.store, (state) => state.values.providerId ?? "");
  const capabilityOverrides = useStore(
    form.store,
    (state) => state.values.capabilityOverrides ?? {}
  );
  const textTemplateValue = useStore(form.store, (state) => state.values.textTemplate ?? null);
  const [selectedProviderId, setSelectedProviderId] = useState(providerId);
  const [modelSearchInput, setModelSearchInput] = useState("");
  const [debouncedModelSearchQuery, setDebouncedModelSearchQuery] = useState("");
  const [isTemplateDialogOpen, setTemplateDialogOpen] = useState(false);

  useEffect(
    function providerChangedEffect() {
      const providerChanged = providerId !== selectedProviderId;
      if (providerChanged) {
        setSelectedProviderId(providerId);
        setModelSearchInput("");
        setDebouncedModelSearchQuery("");
        if (!initialData?.providerId || initialData.providerId !== providerId) {
          form.setFieldValue("modelId", "");
        }
      }
    },
    [form, providerId, selectedProviderId, initialData?.providerId]
  );

  useEffect(
    function modelSearchInputChangedEffect() {
      const timeoutId = window.setTimeout(() => {
        setDebouncedModelSearchQuery(modelSearchInput.trim());
      }, 300);
      return () => window.clearTimeout(timeoutId);
    },
    [modelSearchInput]
  );

  const providerOptions = createProviderCollection(providers);
  const providerCapabilities =
    providers.find((p) => p.id === providerId)?.capabilities ?? undefined;
  const effectiveTextCompletions =
    (capabilityOverrides?.textCompletions ?? providerCapabilities?.textCompletions) === true;

  const searchModelsQuery = useQuery(
    trpc.providers.searchModels.queryOptions(
      { providerId: selectedProviderId, query: debouncedModelSearchQuery },
      { enabled: selectedProviderId.length > 0 }
    )
  );

  const handleModelSelection = (id: string) => form.setFieldValue("modelId", id);

  return (
    <>
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <VStack gap={4} align="stretch">
          <form.AppField name="providerId">
            {(field) => (
              <field.Select
                label="Provider"
                required
                options={providerOptions.items}
                placeholder={providersQuery.isLoading ? "Loading providers..." : "Select provider"}
                disabled={providersQuery.isLoading}
              />
            )}
          </form.AppField>

          <form.AppField name="displayName">
            {(field) => (
              <field.TextInput
                label="Display Name"
                required
                placeholder="e.g., GPT-4o for Creative Writing"
              />
            )}
          </form.AppField>

          {selectedProviderId && (
            <>
              <HStack align="start">
                <Field label="Model Search" helperText="Search available models" flex={1}>
                  <HStack gap={2} align="center">
                    <Input
                      value={modelSearchInput}
                      onChange={(event) => setModelSearchInput(event.target.value)}
                      placeholder="Search models..."
                    />
                    {searchModelsQuery.isLoading && <Spinner size="sm" />}
                  </HStack>
                </Field>
                <ModelSelector
                  models={searchModelsQuery.data?.models}
                  onSelect={handleModelSelection}
                />
              </HStack>

              <form.AppField name="modelId">
                {(field) => (
                  <field.TextInput
                    label="Model ID"
                    required
                    helperText="Enter model ID manually if not found in search above"
                    placeholder="e.g., gpt-4o-mini, deepseek-chat"
                  />
                )}
              </form.AppField>
            </>
          )}

          {!selectedProviderId && (
            <form.AppField name="modelId">
              {(field) => (
                <field.TextInput
                  label="Model ID"
                  required
                  helperText="Select a provider to search, or enter an ID manually"
                  placeholder="e.g., gpt-4o-mini, deepseek-chat"
                />
              )}
            </form.AppField>
          )}

          <form.AppField name="capabilityOverrides">
            {(field) => (
              <field.Field label="Capability Overrides">
                <CapabilitiesSelector
                  value={field.state.value ?? {}}
                  onChange={(next) => field.handleChange(next ?? {})}
                  baseline={providerCapabilities}
                  helperText="Override provider capabilities for this specific model"
                />
              </field.Field>
            )}
          </form.AppField>

          {effectiveTextCompletions ? (
            <VStack align="stretch" gap={2}>
              <Text fontWeight="medium">Text Completion Template</Text>
              <HStack justify="space-between">
                <Text color="content.muted">
                  {textTemplateValue ? "Template configured" : "No template configured"}
                </Text>
                <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
                  {textTemplateValue ? "Edit Template" : "Add Template"}
                </Button>
              </HStack>
            </VStack>
          ) : textTemplateValue ? (
            <VStack align="stretch" gap={2}>
              <Text fontWeight="medium">Text Completion Template</Text>
              <HStack justify="space-between">
                <Text color="content.muted">Template saved but inactive</Text>
                <Button
                  variant="outline"
                  colorPalette="red"
                  onClick={() => form.setFieldValue("textTemplate", null)}
                >
                  Clear Template
                </Button>
              </HStack>
            </VStack>
          ) : null}

          <HStack justify="space-between" width="full" mt={4}>
            <form.AppForm>
              <form.CancelButton variant="ghost" onCancel={onCancel}>
                Cancel
              </form.CancelButton>
              <form.SubmitButton form={formId} colorPalette="primary">
                {submitLabel}
              </form.SubmitButton>
            </form.AppForm>
          </HStack>
        </VStack>
      </form>

      <JinjaTemplateDialog
        isOpen={isTemplateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        initialTemplate={textTemplateValue ?? null}
        onSave={(template) => {
          const next = template.trim();
          form.setFieldValue("textTemplate", next.length > 0 ? next : null);
          setTemplateDialogOpen(false);
        }}
      />
    </>
  );
}

export default ModelProfileForm;

function ModelSelector({
  models,
  onSelect,
}: {
  models?: SearchModelsOutput["models"];
  onSelect: (id: string) => void;
}) {
  "use no memo"; // React Compiler interferes with virtualizer and/or chakra
  const collection = createModelsCollection(models);
  const [availableModelSelection, setAvailableModelSelection] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: collection.size,
    getScrollElement: () => contentRef.current,
    getItemKey: (index) => collection.items[index].value,
    estimateSize: () => 50,
    overscan: 10,
    scrollPaddingEnd: 32,
  });
  const items = v.getVirtualItems();

  if (!models?.length) {
    return null;
  }

  // Required when virtualizing Chakra selects/comboboxes for proper programmatic scrolling
  const handleScrollToIndexFn = (details: { index: number }) => {
    flushSync(() => v.scrollToIndex(details.index, { align: "center", behavior: "auto" }));
  };

  return (
    <Field label="Available Models" flex={2}>
      <SelectRoot
        scrollToIndexFn={handleScrollToIndexFn}
        positioning={{ sameWidth: false }}
        collection={collection}
        value={availableModelSelection ? [availableModelSelection] : []}
        onValueChange={(details) => {
          const next = details.value[0];
          if (!next) return;
          setAvailableModelSelection(next);
          onSelect(next);
        }}
      >
        <SelectTrigger>
          <SelectValueText placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent
          portalled={false}
          ref={contentRef}
          w="xl"
          style={{ display: "block" }} // Default chakra flex style causes incorrect scrollbar size calculation
        >
          <div style={{ height: `${v.getTotalSize()}px`, position: "relative" }}>
            {items.map((row) => {
              const modelItem = collection.items[row.index];
              return (
                <SelectItem
                  key={modelItem.value}
                  item={modelItem}
                  data-index={row.index}
                  ref={v.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${row.start}px)`,
                  }}
                >
                  <VStack align="start" gap={1}>
                    <Text truncate>{modelItem.label}</Text>
                    {modelItem.description && (
                      <Text fontSize="xs" color="content.muted" lineClamp={2}>
                        {modelItem.description}
                      </Text>
                    )}
                  </VStack>
                </SelectItem>
              );
            })}
          </div>
        </SelectContent>
      </SelectRoot>
    </Field>
  );
}

function createProviderCollection(providers: ProviderConfig[]) {
  return createListCollection({
    items: providers.map((provider) => ({
      label: provider.name,
      value: provider.id,
    })),
  });
}

function createModelsCollection(models?: SearchModelsOutput["models"]) {
  console.log("createModelsCollection", models?.length);
  return createListCollection({
    items: (models ?? []).map((model) => ({
      label: model.name || model.id,
      value: model.id,
      description: model.description,
    })),
  });
}

function getInitialValues(initial?: Partial<ModelProfileFormValues>): ModelProfileFormValues {
  return {
    ...modelProfileFormDefaultValues,
    providerId: initial?.providerId ?? "",
    displayName: initial?.displayName ?? "",
    modelId: initial?.modelId ?? "",
    textTemplate: initial?.textTemplate ?? null,
    capabilityOverrides: initial?.capabilityOverrides ?? {},
  };
}

export type ModelProfileFormData = ModelProfileFormValues;
