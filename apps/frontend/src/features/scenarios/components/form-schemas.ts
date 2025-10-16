import { z } from "zod";

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .describe("Hex RGB color string (e.g., #336699)");

const scenarioParticipantFormSchema = z.object({
  characterId: z.string(),
  role: z.string().optional(),
  isUserProxy: z.boolean(),
  colorOverride: hexColorSchema.optional().nullable(),
});

const manualLorebookFormSchema = z.object({
  kind: z.literal("manual"),
  lorebookId: z.string(),
  manualAssignmentId: z.string().nullable(),
  enabled: z.boolean(),
  defaultEnabled: z.boolean(),
  name: z.string().optional(),
  entryCount: z.number().optional(),
});

const characterLorebookFormSchema = z.object({
  kind: z.literal("character"),
  lorebookId: z.string(),
  characterId: z.string(),
  characterLorebookId: z.string(),
  enabled: z.boolean(),
  defaultEnabled: z.boolean(),
  overrideEnabled: z.boolean().nullable(),
  name: z.string().optional(),
  entryCount: z.number().optional(),
});

const scenarioLorebookFormSchema = z.union([manualLorebookFormSchema, characterLorebookFormSchema]);

export const scenarioFormSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000),
  participants: z
    .array(scenarioParticipantFormSchema)
    .min(2, "A scenario requires at least 2 characters"),
  lorebooks: z.array(scenarioLorebookFormSchema),
});

export type ScenarioFormValues = z.infer<typeof scenarioFormSchema>;

export const scenarioFormDefaultValues: ScenarioFormValues = {
  name: "",
  description: "",
  participants: [],
  lorebooks: [],
};
