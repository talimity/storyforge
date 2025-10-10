import { createListCollection, HStack, VStack } from "@chakra-ui/react";
import { createProviderConfigSchema, providerAuthInputSchema } from "@storyforge/contracts";
import { useStore } from "@tanstack/react-form";
import { useId } from "react";
import type { z } from "zod";

import {
  Button,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui";
import { useAppForm } from "@/lib/app-form";
import { emptyToNull, emptyToUndefined } from "@/lib/empty-to-null";
import { CapabilitiesSelector } from "./capabilities-selector";

const providerFormAuthInputSchema = providerAuthInputSchema.extend({
  apiKey: providerAuthInputSchema.shape.apiKey.optional(),
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

const providerKindItems = [
  { label: "OpenRouter", value: "openrouter" },
  { label: "DeepSeek", value: "deepseek" },
  { label: "OpenAI Compatible", value: "openai-compatible" },
  { label: "Mock", value: "mock" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: ProviderFormData["kind"];
}>;

const providerKindOptions = createListCollection({
  items: providerKindItems,
});

const defaultCapabilities = {
  streaming: true,
  assistantPrefill: "explicit" as const,
  tools: false,
  fim: false,
  textCompletions: true,
};

function cloneCapabilities(
  value: ProviderFormData["capabilities"] | undefined
): ProviderFormData["capabilities"] {
  if (!value) {
    return value ?? null;
  }

  return { ...value };
}

function buildDefaultValues(initial?: ProviderFormProps["initialData"]): ProviderFormData {
  const capabilitiesSource = initial?.capabilities ?? defaultCapabilities;

  return {
    kind: initial?.kind ?? "openrouter",
    name: initial?.name ?? "",
    auth: { apiKey: undefined },
    baseUrl: initial?.baseUrl ?? null,
    capabilities: cloneCapabilities(capabilitiesSource),
  };
}

function toNullIfEmpty(value: string): string | null {
  const transformed = emptyToNull(value);
  if (typeof transformed === "string") {
    return transformed;
  }

  return null;
}

function toUndefinedIfEmpty(value: string): string | undefined {
  const transformed = emptyToUndefined(value);
  if (typeof transformed === "string") {
    return transformed;
  }

  return undefined;
}

function isProviderKind(value: string): value is ProviderFormData["kind"] {
  return providerKindItems.some((item) => item.value === value);
}

export function ProviderForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Save Provider",
}: ProviderFormProps) {
  const isEditMode = Boolean(initialData?.name);

  const form = useAppForm({
    defaultValues: buildDefaultValues(initialData),
    validators: {
      onChange: providerFormSchema,
    },
    onSubmit: ({ value }) => {
      const apiKey = value.auth?.apiKey;
      const normalizedApiKey =
        apiKey === undefined || apiKey === null || apiKey === "" ? undefined : apiKey;
      const normalizedCapabilities = value.kind === "openai-compatible" ? value.capabilities : null;

      onSubmit({
        ...value,
        auth: { apiKey: normalizedApiKey },
        baseUrl: value.baseUrl ?? null,
        capabilities: normalizedCapabilities,
      });
    },
  });

  const formId = useId();

  const isOpenAICompatible = useStore(
    form.store,
    (state) => state.values.kind === "openai-compatible"
  );

  const internalIsSubmitting = useStore(form.store, (state) => state.isSubmitting);

  const isBusy = Boolean(isSubmitting) || internalIsSubmitting;

  const apiKeyHelperText = isEditMode
    ? initialData?.auth.hasApiKey
      ? "Leave empty to keep existing API key"
      : "Enter a new API key"
    : undefined;

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <VStack gap={4} align="stretch">
        <form.AppField name="kind">
          {(field) => (
            <field.Field label="Provider Type" required>
              <SelectRoot
                collection={providerKindOptions}
                value={field.state.value ? [field.state.value] : []}
                onValueChange={(details) => {
                  const nextValue = details.value[0];
                  if (nextValue && isProviderKind(nextValue)) {
                    field.handleChange(nextValue);
                  }
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
            </field.Field>
          )}
        </form.AppField>

        <form.AppField name="name">
          {(field) => (
            <field.TextInput
              label="Display Name"
              required
              autoComplete="off"
              placeholder="e.g., OpenRouter (Personal), Local vLLM"
            />
          )}
        </form.AppField>

        <form.AppField name="auth.apiKey">
          {(field) => (
            <field.TextInput
              label="API Key"
              type="password"
              helperText={apiKeyHelperText}
              placeholder={
                isEditMode && initialData?.auth.hasApiKey ? "••••••••" : "Enter your API key"
              }
              transform={toUndefinedIfEmpty}
            />
          )}
        </form.AppField>

        {isOpenAICompatible && (
          <form.AppField name="baseUrl">
            {(field) => (
              <field.TextInput
                label="Base URL"
                placeholder="e.g., http://localhost:8080/v1"
                transform={toNullIfEmpty}
              />
            )}
          </form.AppField>
        )}

        {isOpenAICompatible && (
          <form.AppField name="capabilities">
            {(field) => (
              <field.Field label="Capabilities">
                <CapabilitiesSelector
                  value={field.state.value ?? {}}
                  onChange={(next) => field.handleChange(next)}
                  allowInherit={false}
                  helperText="Configure what this provider supports"
                />
              </field.Field>
            )}
          </form.AppField>
        )}
      </VStack>

      <HStack justify="space-between" width="full" mt={6}>
        <Button variant="ghost" onClick={onCancel} disabled={isBusy}>
          Cancel
        </Button>
        <form.AppForm>
          <form.SubmitButton form={formId} colorPalette="primary">
            {submitLabel}
          </form.SubmitButton>
        </form.AppForm>
      </HStack>
    </form>
  );
}
