import {
  createListCollection,
  HStack,
  Input,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createProviderConfigSchema,
  updateProviderConfigSchema,
} from "@storyforge/schemas";
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

type CreateProviderFormData = z.infer<typeof createProviderConfigSchema>;
type UpdateProviderFormData = z.infer<typeof updateProviderConfigSchema>;
type ProviderFormData = CreateProviderFormData | UpdateProviderFormData;

interface ProviderFormProps {
  initialData?: Partial<ProviderFormData> & {
    hasApiKey?: boolean;
  };
  // biome-ignore lint/suspicious/noExplicitAny: Union types between create/update schemas make proper typing complex
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const providerKindOptions = createListCollection({
  items: [
    { label: "OpenRouter", value: "openrouter" },
    { label: "DeepSeek", value: "deepseek" },
    { label: "OpenAI Compatible", value: "openai-compatible" },
  ],
});

const defaultCapabilities = {
  streaming: true,
  assistantPrefill: false,
  logprobs: false,
  tools: false,
  fim: false,
};

export function ProviderForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Save Provider",
}: ProviderFormProps) {
  const isEditMode = !!initialData?.name;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isValid },
  } = useForm<ProviderFormData>({
    resolver: zodResolver(
      isEditMode ? updateProviderConfigSchema : createProviderConfigSchema
    ),
    mode: "onBlur",
    defaultValues: {
      kind: initialData?.kind || "openrouter",
      name: initialData?.name || "",
      auth: { apiKey: initialData?.auth?.apiKey || "" },
      baseUrl: initialData?.baseUrl || "",
      capabilities: initialData?.capabilities || defaultCapabilities,
    },
  });

  const watchedKind = watch("kind");
  const isOpenAICompatible = watchedKind === "openai-compatible";

  const handleFormSubmit = (data: ProviderFormData) => {
    // For edit mode, don't send empty API key
    if (isEditMode && "auth" in data && !data.auth?.apiKey) {
      const { auth, ...rest } = data;
      onSubmit({
        ...rest,
        capabilities: isOpenAICompatible ? data.capabilities : undefined,
        baseUrl: data.baseUrl || undefined,
      });
    } else {
      onSubmit({
        ...data,
        capabilities: isOpenAICompatible ? data.capabilities : undefined,
        baseUrl: data.baseUrl || undefined,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} id="provider-form">
      <VStack gap={4} align="stretch">
        <Field label="Provider Type" required errorText={errors.kind?.message}>
          <Controller
            name="kind"
            control={control}
            render={({ field }) => (
              <SelectRoot
                collection={providerKindOptions}
                value={field.value ? [field.value] : []}
                onValueChange={(details) => {
                  field.onChange(details.value[0]);
                }}
              >
                <SelectTrigger>
                  <SelectValueText placeholder="Select provider type" />
                </SelectTrigger>
                <SelectContent portalled={false}>
                  {providerKindOptions.items.map((item) => (
                    <SelectItem key={item.value} item={item}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            )}
          />
        </Field>

        <Field label="Display Name" required errorText={errors.name?.message}>
          <Input
            {...register("name")}
            placeholder="e.g., OpenRouter (Personal), Local vLLM"
          />
        </Field>

        <Field
          label="API Key"
          required={!isEditMode}
          errorText={errors.auth?.apiKey?.message}
          helperText={
            isEditMode && initialData?.hasApiKey
              ? "Leave empty to keep existing API key"
              : isEditMode
                ? "Enter a new API key"
                : undefined
          }
        >
          <Input
            {...register("auth.apiKey")}
            type="password"
            placeholder={
              isEditMode && initialData?.hasApiKey
                ? "••••••••"
                : "Enter your API key"
            }
          />
        </Field>

        {isOpenAICompatible && (
          <Field label="Base URL" required errorText={errors.baseUrl?.message}>
            <Input
              {...register("baseUrl")}
              placeholder="e.g., http://localhost:8080/v1"
            />
          </Field>
        )}

        {isOpenAICompatible && (
          <Field label="Capabilities">
            <VStack gap={2} align="stretch">
              <Text fontSize="sm" color="content.muted">
                Configure what this provider supports
              </Text>
              <Stack gap={2}>
                <Controller
                  name="capabilities.streaming"
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
                  name="capabilities.assistantPrefill"
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
                  name="capabilities.logprobs"
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
                  name="capabilities.tools"
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
                  name="capabilities.fim"
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
        )}
      </VStack>

      <HStack justify="space-between" width="full" mt={6}>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="provider-form"
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
