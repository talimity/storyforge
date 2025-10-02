import { createListCollection, HStack, Input, Spinner, Text, VStack } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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

export function ModelProfileForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Save Model Profile",
}: ModelProfileFormProps) {
  const trpc = useTRPC();
  const providersQuery = useQuery(trpc.providers.list.queryOptions());
  const providers = providersQuery.data?.providers ?? [];

  const initialValues = useMemo<ModelProfileFormValues>(
    () => ({
      ...modelProfileFormDefaultValues,
      providerId: initialData?.providerId ?? "",
      displayName: initialData?.displayName ?? "",
      modelId: initialData?.modelId ?? "",
      textTemplate: initialData?.textTemplate ?? null,
      capabilityOverrides: initialData?.capabilityOverrides ?? {},
    }),
    [initialData]
  );

  const form = useAppForm({
    defaultValues: initialValues,
    validators: { onSubmit: modelProfileFormSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

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

  useEffect(() => {
    const providerChanged = providerId !== selectedProviderId;
    if (providerChanged) {
      setSelectedProviderId(providerId);
      setModelSearchInput("");
      setDebouncedModelSearchQuery("");
      if (!initialData?.providerId || initialData.providerId !== providerId) {
        form.setFieldValue("modelId", "");
      }
    }
  }, [form, providerId, selectedProviderId, initialData?.providerId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedModelSearchQuery(modelSearchInput.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [modelSearchInput]);

  const providerOptions = useMemo(
    () =>
      createListCollection({
        items: providers.map((provider) => ({
          label: provider.name,
          value: provider.id,
        })),
      }),
    [providers]
  );

  const providerCapabilities = useMemo(
    () => providers.find((p) => p.id === providerId)?.capabilities ?? undefined,
    [providers, providerId]
  );

  const effectiveTextCompletions =
    (capabilityOverrides?.textCompletions ?? providerCapabilities?.textCompletions) === true;

  const searchModelsQuery = useQuery(
    trpc.providers.searchModels.queryOptions(
      { providerId: selectedProviderId, query: debouncedModelSearchQuery },
      { enabled: selectedProviderId.length > 0 }
    )
  );

  const modelOptions = useMemo(
    () =>
      createListCollection({
        items: (searchModelsQuery.data?.models ?? []).map((model) => ({
          label: model.name || model.id,
          value: model.id,
          description: model.description,
        })),
      }),
    [searchModelsQuery.data?.models]
  );

  return (
    <>
      <form
        id="model-profile-form"
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
              <Field
                label="Model Search"
                helperText="Search available models or enter manually below"
              >
                <HStack gap={2} align="center">
                  <Input
                    value={modelSearchInput}
                    onChange={(event) => setModelSearchInput(event.target.value)}
                    placeholder="Search models..."
                  />
                  {searchModelsQuery.isLoading && <Spinner size="sm" />}
                </HStack>
              </Field>

              <form.AppField name="modelId">
                {(field) => (
                  <>
                    {modelOptions.items.length > 0 && (
                      <field.Field label="Available Models">
                        <SelectRoot
                          collection={modelOptions}
                          value={field.state.value ? [field.state.value] : []}
                          onValueChange={(details) => {
                            const next = details.value[0];
                            if (!next) return;
                            field.handleChange(next);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValueText placeholder="Select a model" />
                          </SelectTrigger>
                          <SelectContent portalled={false}>
                            {modelOptions.items.map((item) => (
                              <SelectItem key={item.value} item={item}>
                                <VStack align="start" gap={1}>
                                  <Text>{item.label}</Text>
                                  {item.description && (
                                    <Text fontSize="xs" color="content.muted" lineClamp={2}>
                                      {item.description}
                                    </Text>
                                  )}
                                </VStack>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </SelectRoot>
                      </field.Field>
                    )}

                    <field.TextInput
                      label="Model ID"
                      required
                      helperText="Enter model ID manually if not found in search above"
                      placeholder="e.g., gpt-4o-mini, deepseek-chat"
                    />
                  </>
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
              <form.SubmitButton form="model-profile-form" colorPalette="primary">
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

export type ModelProfileFormData = ModelProfileFormValues;
