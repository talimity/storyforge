import { z } from "zod";
import { init } from "zod-empty";

const lorebookEntryOptionalNumber = z.number().finite().optional();

export const lorebookEntryFormSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  enabled: z.boolean(),
  constant: z.boolean().optional(),
  comment: z.string().optional(),
  keys: z.array(z.string().min(1, "Keyword cannot be empty")),
  selective: z.boolean().optional(),
  secondary_keys: z.array(z.string().min(1)).optional(),
  extensions: z.record(z.string(), z.unknown()),
  insertion_order: z.number().int().min(0),
  case_sensitive: z.boolean().optional(),
  priority: lorebookEntryOptionalNumber,
  content: z.string().min(1, "Content is required"),
  position: z
    .union([z.literal("before_char"), z.literal("after_char"), z.string(), z.number()])
    .optional(),
  use_regex: z.boolean().optional(),
});

export const lorebookFormSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    scan_depth: z.number().int().min(0).optional(),
    token_budget: z.number().int().min(0).optional(),
    recursive_scanning: z.boolean().optional(),
    extensions: z.record(z.string(), z.unknown()),
    entries: z.array(lorebookEntryFormSchema).min(1, "Add at least one lore entry"),
  })
  .superRefine((val, ctx) => {
    const enabledEntries = val.entries.filter((entry) => entry.enabled);
    if (enabledEntries.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["entries"],
        message: "At least one entry must be enabled",
      });
    }
  });

export type LorebookEntryFormValues = z.infer<typeof lorebookEntryFormSchema>;

export type LorebookFormValues = z.infer<typeof lorebookFormSchema>;

const rawLorebookDefaults = init(lorebookFormSchema);

export const lorebookFormDefaultValues: LorebookFormValues = {
  ...rawLorebookDefaults,
  extensions: rawLorebookDefaults.extensions ?? {},
  entries: rawLorebookDefaults.entries ?? [],
};

export function createLorebookEntryDraft(initOrder: number): LorebookEntryFormValues {
  return {
    keys: [""],
    content: "",
    enabled: true,
    extensions: {},
    insertion_order: initOrder,
  };
}
