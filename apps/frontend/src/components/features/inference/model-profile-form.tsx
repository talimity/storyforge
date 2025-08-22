import {
  createListCollection,
  HStack,
  Input,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createModelProfileSchema,
  updateModelProfileSchema,
} from "@storyforge/schemas";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import {
  Button,
  Checkbox,
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui";
import { trpc } from "@/lib/trpc";

type CreateModelProfileFormData = z.infer<typeof createModelProfileSchema>;
type UpdateModelProfileFormData = z.infer<typeof updateModelProfileSchema>;
type ModelProfileFormData =
  | CreateModelProfileFormData
  | UpdateModelProfileFormData;

interface ModelProfileFormProps {
  initialData?: Partial<ModelProfileFormData>;
  // biome-ignore lint/suspicious/noExplicitAny: Union types between create/update schemas make proper typing complex
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const defaultCapabilityOverrides = {
  streaming: false,
  assistantPrefill: false,
  logprobs: false,
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
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    initialData?.providerId || ""
  );
  const [modelSearchQuery, setModelSearchQuery] = useState("");

  // Get list of providers
  const providersQuery = trpc.providers.listProviders.useQuery();
  const providers = providersQuery.data?.providers || [];

  // Search models when provider is selected
  const searchModelsQuery = trpc.providers.searchModels.useQuery(
    {
      providerId: selectedProviderId,
      query: modelSearchQuery,
    },
    {
      enabled: !!selectedProviderId,
    }
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<ModelProfileFormData>({
    resolver: zodResolver(
      initialData?.providerId
        ? updateModelProfileSchema
        : createModelProfileSchema
    ),
    mode: "onBlur",
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
                  disabled={searchModelsQuery.isLoading}
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
                            {item.label}
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
              <Input
                {...register("modelId")}
                placeholder="e.g., gpt-4o-mini, deepseek-chat"
              />
            </Field>
          </>
        )}

        <Field label="Capability Overrides">
          <VStack gap={2} align="stretch">
            <Text fontSize="sm" color="content.muted">
              Override provider capabilities for this specific model
            </Text>
            <Stack gap={2}>
              <Controller
                name="capabilityOverrides.streaming"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={({ checked }) => field.onChange(checked)}
                  >
                    Streaming responses
                  </Checkbox>
                )}
              />
              <Controller
                name="capabilityOverrides.assistantPrefill"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={({ checked }) => field.onChange(checked)}
                  >
                    Assistant message prefill
                  </Checkbox>
                )}
              />
              <Controller
                name="capabilityOverrides.logprobs"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={({ checked }) => field.onChange(checked)}
                  >
                    Log probabilities
                  </Checkbox>
                )}
              />
              <Controller
                name="capabilityOverrides.tools"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={({ checked }) => field.onChange(checked)}
                  >
                    Tool calling
                  </Checkbox>
                )}
              />
              <Controller
                name="capabilityOverrides.fim"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={({ checked }) => field.onChange(checked)}
                  >
                    Fill-in-the-middle
                  </Checkbox>
                )}
              />
            </Stack>
          </VStack>
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
