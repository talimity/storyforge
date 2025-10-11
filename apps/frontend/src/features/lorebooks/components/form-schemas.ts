import { lorebookDataSchema, lorebookEntrySchema } from "@storyforge/contracts";
import { createId } from "@storyforge/utils";
import { z } from "zod";
import { init } from "zod-empty";
import { jsonText } from "@/lib/form/json-text-zod";

// Reused refinement for ui/submit schemas
const requireAtLeastOneEnabled = (
  val: { entries: Array<{ enabled?: boolean }> },
  ctx: z.RefinementCtx
) => {
  const enabled = (val.entries ?? []).filter((e) => e.enabled);
  if (enabled.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["entries"],
      message: "At least one entry must be enabled",
    });
  }
};

// JSON Schema for editor linting
export const extensionsJsonSchema = z.toJSONSchema(lorebookEntrySchema.shape.extensions);

// --- UI schemas (strings where we use the JSON editor) ---
const lorebookEntryUiSchema = z.object({
  ...lorebookEntrySchema.shape,
  id: lorebookEntrySchema.shape.id.unwrap(), // avoid |undefined caused by .default
  extensions: z.string().default("{}").unwrap(), // UI uses a string
});

// --- Submit schemas (strings parsed into objects) ---
const lorebookEntrySubmitSchema = z.object({
  ...lorebookEntrySchema.shape,
  id: lorebookEntrySchema.shape.id.unwrap(),
  extensions: jsonText(lorebookEntrySchema.shape.extensions),
});

export const lorebookSubmitSchema = z
  .object({
    ...lorebookDataSchema.shape,
    extensions: jsonText(lorebookDataSchema.shape.extensions),
    entries: z.array(lorebookEntrySubmitSchema),
  })
  .superRefine(requireAtLeastOneEnabled);

// Defaults for the UI form, also lets tanstack form infer form shape
export const lorebookFormDefaultValues = init(
  z.object({
    ...lorebookDataSchema.shape,
    extensions: z.string().default("{}").unwrap(),
    entries: z.array(lorebookEntryUiSchema),
  })
);

// Types
export type LorebookEntryFormValues = z.infer<typeof lorebookEntryUiSchema>;
export type LorebookFormValues = typeof lorebookFormDefaultValues; // edited in the form
export type LorebookPayload = z.output<typeof lorebookSubmitSchema>; // sent to the API

export function createLorebookEntryDraft(insertion_order: number): LorebookEntryFormValues {
  return {
    id: createId(),
    keys: [],
    content: "",
    enabled: true,
    extensions: "{}",
    insertion_order,
  } satisfies z.infer<typeof lorebookEntryUiSchema>;
}

// Helpful adapters to avoid duplicating stringify/parse logic in pages:
export function toLorebookFormInitial(
  data: z.infer<typeof lorebookDataSchema>
): LorebookFormValues {
  return {
    name: data.name ?? "",
    description: data.description ?? undefined,
    scan_depth: data.scan_depth ?? undefined,
    token_budget: data.token_budget ?? undefined,
    recursive_scanning: data.recursive_scanning ?? undefined,
    extensions: JSON.stringify(data.extensions ?? {}, null, 2),
    entries: data.entries.map((e) => ({
      ...e,
      id: String(e.id), // your UI already unwraps id
      extensions: JSON.stringify(e.extensions ?? {}, null, 2),
    })),
  };
}

export function toLorebookPayload(values: LorebookFormValues): LorebookPayload {
  // Single source of truth for “form -> API”
  return lorebookSubmitSchema.parse(values);
}
