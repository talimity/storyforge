import { z } from "zod";

export const intentKindSchema = z.enum([
  "manual_control",
  "guided_control",
  "narrative_constraint",
  "continue_story",
]);

export const intentStatusSchema = z.enum(["pending", "running", "finished", "failed", "cancelled"]);

export const intentInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("manual_control"),
    text: z.string().min(1).max(50000),
    targetParticipantId: z.string(),
  }),
  z.object({
    kind: z.literal("guided_control"),
    text: z.string().min(1).max(50000),
    targetParticipantId: z.string(),
  }),
  z.object({
    kind: z.literal("narrative_constraint"),
    text: z.string().min(1).max(50000),
    targetParticipantId: z.string().optional(),
  }),
  z.object({
    kind: z.literal("continue_story"),
    targetParticipantId: z.string().optional(),
  }),
]);

export const intentReplayInputSchema = z
  .object({
    generationRunId: z.string(),
    resumeFromStepId: z.string(),
    stepOutputOverrides: z.record(z.string(), z.unknown()).optional(),
    expectedWorkflowId: z.string().optional(),
  })
  .describe("Replay configuration that seeds a workflow from a previous generation run");

// Intent API schemas
export const createIntentInputSchema = z.object({
  scenarioId: z.string(),
  parameters: intentInputSchema,
  branchFrom: z
    .object({ kind: z.enum(["turn_parent", "intent_start"]), targetId: z.string() })
    .optional()
    .describe(
      "Optionally creates a branching point by applying the intent's effects to a specified parent turn, or to the same parent of a previously-created intent"
    ),
  replayFrom: intentReplayInputSchema.optional(),
});
export const createIntentOutputSchema = z.object({ intentId: z.string() });

export const intentEffectSchema = z
  .object({
    intentId: z.string().describe("ID of the intent that created this effect"),
    sequence: z.number().describe("Order of this effect among all created by this intent"),
    kind: z.enum(["new_turn"]).describe("Type of effect on the timeline"),
    turnId: z.string().nullable().describe("ID of the turn created by this effect"),
  })
  .describe("Representation of an effect of player's intent (ie. new turns)");

export const intentSchema = z
  .object({
    id: z.string(),
    scenarioId: z.string(),
    kind: intentKindSchema,
    status: intentStatusSchema.describe("Current status of intent"),
    effects: z.array(intentEffectSchema).describe("Array of effects created by this intent"),
  })
  .describe("Representation of a player's intent to influence the story");

// Intent progress schemas
export const intentProgressInputSchema = z.object({ intentId: z.string() });

export const intentResultInputSchema = z.object({ intentId: z.string() });
export const intentResultOutputSchema = intentSchema;

// Interrupt intent
export const intentInterruptInputSchema = z.object({ intentId: z.string() });
export const intentInterruptOutputSchema = z.object({ success: z.boolean() });

// Type exports
export type IntentKind = z.infer<typeof intentKindSchema>;
export type IntentInput = z.infer<typeof intentInputSchema>;
export type CreateIntentInput = z.infer<typeof createIntentInputSchema>;
export type CreateIntentOutput = z.infer<typeof createIntentOutputSchema>;
export type Intent = z.infer<typeof intentSchema>;
export type IntentStatus = z.infer<typeof intentStatusSchema>;
export type IntentEffect = z.infer<typeof intentEffectSchema>;
export type IntentInterruptInput = z.infer<typeof intentInterruptInputSchema>;
export type IntentInterruptOutput = z.infer<typeof intentInterruptOutputSchema>;
export type IntentReplayInput = z.infer<typeof intentReplayInputSchema>;
