import { genStepSchema, taskKindSchema } from "@storyforge/gentasks";
import { z } from "zod";
import { init } from "zod-empty";

// Client-side refinements while remaining compatible with server schema
export const workflowFormStepSchema = genStepSchema
  .extend({
    stop: z.array(z.string()),
    modelProfileId: z.string().min(1, "Model profile is required"),
    promptTemplateId: z.string().min(1, "Prompt template is required"),
    outputs: genStepSchema.shape.outputs.min(1, "Add at least one output"),
  })
  .superRefine((val, ctx) => {
    if (val.maxOutputTokens !== undefined && val.maxOutputTokens <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["maxOutputTokens"],
        message: "Must be > 0",
      });
    }
    if (val.maxContextTokens !== undefined && val.maxContextTokens <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["maxContextTokens"],
        message: "Must be > 0",
      });
    }
  });

export const workflowFormSchema = z.object({
  task: taskKindSchema,
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  steps: z.array(workflowFormStepSchema).min(1, "Add at least one step"),
});
export const workflowFormDefaultValues = init(workflowFormSchema);

export type WorkflowFormValues = z.infer<typeof workflowFormSchema>;
