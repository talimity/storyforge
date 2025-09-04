import {
  createListCollection,
  HStack,
  Input,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createModelProfileSchema } from "@storyforge/schemas";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import {
  Button,
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { CapabilitiesSelector } from "./capabilities-selector";

const modelProfileFormSchema = createModelProfileSchema.pick({
  providerId: true,
  displayName: true,
  modelId: true,
  capabilityOverrides: true,
});
export type ModelProfileFormData = z.infer<typeof modelProfileFormSchema>;

interface ModelProfileFormProps {
  initialData?: Partial<ModelProfileFormData>;
  onSubmit: (data: ModelProfileFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const defaultCapabilityOverrides = {
  streaming: false,
  assistantPrefill: "unsupported" as const,
  tools: false,
  fim: false,
};

export function ModelProfileForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Save Model Profile",
}: ModelProfileFormProps) {
  const [selectedProviderId, setSelectedProviderId] = useState(
    initialData?.providerId || ""
  );
  const [modelSearchQuery, setModelSearchQuery] = useState("");

  const providersQuery = trpc.providers.listProviders.useQuery();
  const providers = providersQuery.data?.providers || [];

  // Search models when provider is selected
  const searchModelsQuery = trpc.providers.searchModels.useQuery(
    { providerId: selectedProviderId, query: modelSearchQuery },
    { enabled: !!selectedProviderId }
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<ModelProfileFormData>({
    resolver: zodResolver(modelProfileFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      providerId: initialData?.providerId || "",
      displayName: initialData?.displayName || "",
      modelId: initialData?.modelId || "",
      capabilityOverrides:
        initialData?.capabilityOverrides || defaultCapabilityOverrides,
    },
  });

  const watchedProviderId = watch("providerId");

  // Update provider selection state when form changes
  useEffect(() => {
    if (watchedProviderId && watchedProviderId !== selectedProviderId) {
      setSelectedProviderId(watchedProviderId);
      // Clear model selection when provider changes (only for create mode)
      if (!initialData?.providerId) {
        setValue("modelId", "");
      }
    }
  }, [
    watchedProviderId,
    selectedProviderId,
    setValue,
    initialData?.providerId,
  ]);

  const handleFormSubmit = (data: ModelProfileFormData) => {
    onSubmit(data);
  };

  const providerOptions = createListCollection({
    items: providers.map((provider) => ({
      label: provider.name,
      value: provider.id,
    })),
  });

  const modelOptions = createListCollection({
    items: (searchModelsQuery.data?.models || []).map((model) => ({
      label: model.name || model.id,
      value: model.id,
      description: model.description,
    })),
  });

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} id="model-profile-form">
      <VStack gap={4} align="stretch">
        <Field label="Provider" required errorText={errors.providerId?.message}>
          <Controller
            name="providerId"
            control={control}
            render={({ field }) => (
              <SelectRoot
                collection={providerOptions}
                value={field.value ? [field.value] : []}
                onValueChange={(details) => field.onChange(details.value[0])}
              >
                <SelectTrigger>
                  <SelectValueText placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent portalled={false}>
                  {providerOptions.items.map((item) => (
                    <SelectItem key={item.value} item={item}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            )}
          />
        </Field>

        <Field
          label="Display Name"
          required
          errorText={errors.displayName?.message}
        >
          <Input
            {...register("displayName")}
            placeholder="e.g., GPT-4o for Creative Writing"
          />
        </Field>

        {selectedProviderId && (
          <>
            <Field
              label="Model Search"
              helperText="Search available models or enter manually below"
            >
              <HStack gap={2}>
                <Input
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  placeholder="Search models..."
                />
                {searchModelsQuery.isLoading && <Spinner size="sm" />}
              </HStack>
            </Field>

            {modelOptions.items.length > 0 && (
              <Field label="Available Models">
                <Controller
                  name="modelId"
                  control={control}
                  render={({ field }) => (
                    <SelectRoot
                      collection={modelOptions}
                      value={field.value ? [field.value] : []}
                      onValueChange={(details) =>
                        field.onChange(details.value[0])
                      }
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
                                <Text
                                  fontSize="xs"
                                  color="content.muted"
                                  lineClamp={2}
                                >
                                  {item.description}
                                </Text>
                              )}
                            </VStack>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </SelectRoot>
                  )}
                />
              </Field>
            )}

            <Field
              label="Model ID"
              required
              errorText={errors.modelId?.message}
              helperText="Enter model ID manually if not found in search above"
            >
              <Controller
                name="modelId"
                control={control}
                render={({ field }) => (
                  <Input
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder="e.g., gpt-4o-mini, deepseek-chat"
                  />
                )}
              />
            </Field>
          </>
        )}

        <Field label="Capability Overrides">
          <Controller
            name="capabilityOverrides"
            control={control}
            render={({ field }) => (
              <CapabilitiesSelector
                value={field.value || {}}
                onChange={field.onChange}
                baseline={
                  providers.find((p) => p.id === selectedProviderId)
                    ?.capabilities || undefined
                }
                helperText="Override provider capabilities for this specific model"
              />
            )}
          />
        </Field>
      </VStack>

      <HStack justify="space-between" width="full" mt={6}>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="model-profile-form"
          colorPalette="primary"
          loading={isSubmitting}
          disabled={!isValid}
        >
          {submitLabel}
        </Button>
      </HStack>
    </form>
  );
}
