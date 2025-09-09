import { z } from "zod";

export const textInferenceCapabilitiesSchema = z.object({
  streaming: z.boolean(),
  assistantPrefill: z.enum(["implicit", "explicit", "unsupported"]),
  tools: z.boolean(),
  fim: z.boolean(),
});
