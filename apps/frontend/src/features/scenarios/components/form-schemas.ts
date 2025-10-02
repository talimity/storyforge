import { z } from "zod";
import { init } from "zod-empty";

export const scenarioFormSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000),
  participants: z
    .array(
      z.object({
        characterId: z.string(),
        role: z.string().optional(),
        isUserProxy: z.boolean().optional(),
      })
    )
    .min(2, "A scenario requires at least 2 characters"),
});
export const scenarioFormDefaultValues = init(scenarioFormSchema);

export type ScenarioFormValues = z.infer<typeof scenarioFormSchema>;
