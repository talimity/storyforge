import { taskKindSchema } from "@storyforge/prompt-renderer";
import { z } from "zod";

// Form validation schema for template metadata
export const templateFormSchema = z.object({
  name: z
    .string()
    .min(1, "Template name is required")
    .max(255, "Name too long"),
  task: taskKindSchema,
  description: z.string().max(2000, "Description too long").optional(),
  responseFormat: z
    .union([
      z.literal("text"),
      z.literal("json"),
      z.object({
        type: z.literal("json_schema"),
        schema: z.record(z.string(), z.unknown()),
      }),
    ])
    .optional(),
});

export type TemplateFormData = z.infer<typeof templateFormSchema>;

// Extended form data that includes the builder state
export interface TemplateFormState extends TemplateFormData {
  layoutDraft: import("./types").LayoutNodeDraft[];
  slotsDraft: Record<string, import("./types").SlotDraft>;
  selectedNodeId?: string;
}

// Form submission data that includes everything needed to save
export interface TemplateSubmissionData {
  metadata: TemplateFormData;
  layoutDraft: import("./types").LayoutNodeDraft[];
  slotsDraft: Record<string, import("./types").SlotDraft>;
}
