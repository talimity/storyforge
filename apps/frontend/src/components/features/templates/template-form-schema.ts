import { taskKindSchema } from "@storyforge/prompt-renderer";
import { z } from "zod";

export const templateFormSchema = z.object({
  name: z
    .string()
    .min(1, "Template name is required")
    .max(255, "Name too long"),
  task: taskKindSchema,
  description: z.string().max(2000, "Description too long").optional(),
});

export type TemplateFormData = z.infer<typeof templateFormSchema>;
