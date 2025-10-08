import { type LorebookEntry, lorebookEntrySchema } from "@storyforge/contracts";
import { createId } from "@storyforge/utils";
import { z } from "zod";
import { init } from "zod-empty";

// .default() on some fields adds | undefined to inferred Standard Schema type,
// which breaks zod form resolver.
const lorebookEntryFormSchema = lorebookEntrySchema.extend({
  id: lorebookEntrySchema.shape.id.unwrap(),
  extensions: lorebookEntrySchema.shape.extensions.unwrap(),
});

export const lorebookFormSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    entries: z.array(lorebookEntryFormSchema).min(1, "Add at least one lore entry"),
    description: z.string().optional(),
    scan_depth: z.number().int().min(0).optional(),
    token_budget: z.number().int().min(0).optional(),
    recursive_scanning: z.boolean().optional(),
    extensions: z.record(z.string(), z.unknown()),
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

export type LorebookEntryFormValues = LorebookEntry;
export const lorebookFormDefaultValues = init(lorebookFormSchema);

export type LorebookFormValues = z.infer<typeof lorebookFormSchema>;

export function createLorebookEntryDraft(initOrder: number): LorebookEntryFormValues {
  return {
    id: createId(),
    keys: [],
    content: "",
    enabled: true,
    extensions: {},
    insertion_order: initOrder,
  };
}
