import { createModelProfileSchema } from "@storyforge/contracts";
import type { z } from "zod";
import { init } from "zod-empty";

export const modelProfileFormSchema = createModelProfileSchema.pick({
  providerId: true,
  displayName: true,
  modelId: true,
  textTemplate: true,
  capabilityOverrides: true,
});

export const modelProfileFormDefaultValues = init(modelProfileFormSchema);

export type ModelProfileFormValues = z.infer<typeof modelProfileFormSchema>;
