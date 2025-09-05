import { createListCollection, HStack, Input, VStack } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createProviderConfigSchema,
  providerAuthInputSchema,
} from "@storyforge/schemas";
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
import { emptyToNull, emptyToUndefined } from "@/lib/utils/empty-to-null";
import { CapabilitiesSelector } from "./capabilities-selector";

const providerFormAuthInputSchema = providerAuthInputSchema.extend({
  apiKey: providerAuthInputSchema.shape.apiKey.optional(), // let user keep existing key
});
const providerFormSchema = createProviderConfigSchema
  .pick({ kind: true, name: true, baseUrl: true, capabilities: true })
  .extend({ auth: providerFormAuthInputSchema });

export type ProviderFormData = z.infer<typeof providerFormSchema>;

type ProviderFormProps = {
  initialData?: Partial<Omit<ProviderFormData, "auth">> & {
    auth: { hasApiKey: boolean };
  };
  onSubmit: (data: ProviderFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
};

const providerKindOptions = createListCollection({
  items: [
    { label: "OpenRouter", value: "openrouter" },
    { label: "DeepSeek", value: "deepseek" },
    { label: "OpenAI Compatible", value: "openai-compatible" },
  ],
});

const defaultCapabilities = {
  streaming: true,
  assistantPrefill: "explicit" as const,
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
    formState: { errors },
  } = useForm<ProviderFormData>({
    resolver: zodResolver(providerFormSchema),
    mode: "onChange",
    defaultValues: {
      kind: initialData?.kind || "openrouter",
      name: initialData?.name || "",
      auth: undefined,
      baseUrl: initialData?.baseUrl || null,
      capabilities: initialData?.capabilities || defaultCapabilities,
    },
  });

  const watchedKind = watch("kind");
  const isOpenAICompatible = watchedKind === "openai-compatible";

  const handleFormSubmit = (data: ProviderFormData) => {
    // Normalize api key (empty string treated as undefined)
    const key = data.auth?.apiKey || undefined;
    // TODO: We need a button for user to clear an API key.
    onSubmit({
      ...data,
      auth: { ...data.auth, apiKey: key },
      capabilities: isOpenAICompatible ? data.capabilities : null,
      baseUrl: data.baseUrl,
    });
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

        <Field
          label="Display Name"
          required
          invalid={!!errors.name?.message}
          errorText={errors.name?.message}
        >
          <Input
            {...register("name")}
            placeholder="e.g., OpenRouter (Personal), Local vLLM"
          />
        </Field>

        <Field
          label="API Key"
          invalid={!!errors.auth?.apiKey?.message}
          errorText={errors.auth?.apiKey?.message}
          helperText={
            isEditMode && initialData?.auth.hasApiKey
              ? "Leave empty to keep existing API key"
              : isEditMode
                ? "Enter a new API key"
                : undefined
          }
        >
          <Input
            {...register("auth.apiKey", { setValueAs: emptyToUndefined })} // don't send null to server as it will clear existing key
            type="password"
            placeholder={
              isEditMode && initialData?.auth.hasApiKey
                ? "••••••••"
                : "Enter your API key"
            }
          />
        </Field>

        {isOpenAICompatible && (
          <Field
            label="Base URL"
            invalid={!!errors.baseUrl?.message}
            errorText={errors.baseUrl?.message}
          >
            <Input
              {...register("baseUrl", { setValueAs: emptyToNull })}
              placeholder="e.g., http://localhost:8080/v1"
            />
          </Field>
        )}

        {isOpenAICompatible && (
          <Field label="Capabilities">
            <Controller
              name="capabilities"
              control={control}
              render={({ field }) => (
                <CapabilitiesSelector
                  value={field.value || {}}
                  onChange={field.onChange}
                  allowInherit={false}
                  helperText="Configure what this provider supports"
                />
              )}
            />
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
        >
          {submitLabel}
        </Button>
      </HStack>
    </form>
  );
}
