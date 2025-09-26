import type { ChatCompletionMessage, ChatCompletionResponse } from "@storyforge/inference";
import { z } from "zod";

export const intentKindSchema = z.enum([
  "manual_control",
  "guided_control",
  "narrative_constraint",
  "continue_story",
]);

export const intentStatusSchema = z.enum(["pending", "running", "finished", "failed", "cancelled"]);

export const generationRunStatusSchema = z.enum(["running", "finished", "error", "cancelled"]);

export const generationInfoMessageSchema = z.custom<ChatCompletionMessage>().meta({
  description: "A message from the generation run",
});
export const generationInfoResponseSchema = z.custom<ChatCompletionResponse>().meta({
  description: "A response from the generation run",
});

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
  }),
  z.object({
    kind: z.literal("continue_story"),
  }),
]);

// Play Environment API schemas
export const environmentInputSchema = z.object({ scenarioId: z.string() });

export const environmentOutputSchema = z.object({
  scenario: z
    .object({
      id: z.string(),
      title: z.string(),
      rootTurnId: z.string().nullable().describe("First turn in the scenario"),
      anchorTurnId: z
        .string()
        .nullable()
        .describe("Identifies the last turn in the scenario's active timeline"),
    })
    .describe("Scenario metadata"),
  participants: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["character", "narrator", "deleted_character"]),
        status: z.enum(["active", "inactive"]),
        characterId: z.string().nullable(),
      })
    )
    .describe("Participants in the scenario (including narrator)"),
  characters: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        imagePath: z.string().nullable(),
        avatarPath: z.string().nullable(),
      })
    )
    .describe("Characters in the scenario"),
  generatingIntent: z
    .lazy(() => intentSchema)
    .nullable()
    .describe("Currently generating intent, if any"),
});

// Timeline API schemas
export const loadTimelineInputSchema = z.object({
  scenarioId: z.string(),
  timelineLeafTurnId: z
    .string()
    .optional()
    .describe("ID of the leaf of the desired timeline; defaults to scenario's anchor turn"),
  cursor: z.string().optional().describe("ID of start of this timeline slice (defaults to anchor)"),
  windowSize: z.number().min(1).max(100).describe("Number of turns to load from the cursor"),
  layer: z
    .string()
    .optional()
    .default("presentation")
    .describe("Content layer to load for each turn"),
});

export const timelineTurnSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  parentTurnId: z
    .string()
    .nullable()
    .describe("Previous turn in this timeline (or null for the root turn)"),
  authorParticipantId: z.string().describe("Participant ID of the author of this turn"),
  turnNo: z.number().describe("1-based position of this turn from the timeline root"),
  swipes: z
    .object({
      leftTurnId: z.string().nullable().describe("Previous sibling turn, forking left"),
      rightTurnId: z.string().nullable().describe("Next sibling turn, forking right"),
      swipeCount: z.number().describe("Sibling count for this turn, including itself"),
      swipeNo: z.number().describe("1-based position of this swipe among its siblings"),
    })
    .describe("Swipe (alternate branch) information for this turn"),
  layer: z.literal("presentation").describe("The content layer being loaded"),
  content: z
    .object({ text: z.string(), createdAt: z.date(), updatedAt: z.date() })
    .describe("Content for this turn in the specified layer"),
  createdAt: z.date(),
  updatedAt: z.date(),
  intentProvenance: z
    .object({
      intentId: z.string(),
      intentKind: intentKindSchema,
      intentStatus: intentStatusSchema,
      effectSequence: z.number(),
      effectCount: z.number(),
      inputText: z.string().nullable(),
      targetParticipantId: z.string().nullable(),
    })
    .nullable()
    .describe("Details about the intent that created this turn, if available"),
});

export const loadTimelineOutputSchema = z.object({
  timeline: z.array(timelineTurnSchema).describe("Array of turns in the loaded timeline slice"),
  cursors: z.object({
    nextCursor: z.string().nullable().describe("Cursor for the next page of turns, if any"),
  }),
  timelineLength: z.number().describe("Number of turns in the timeline from root to the leaf"),
});

export const addTurnInputSchema = z.object({
  scenarioId: z.string(),
  text: z.string(),
  authorParticipantId: z.string(),
  parentTurnId: z.string().optional(),
});

export const addTurnOutputSchema = z.object({ turnId: z.string() });

export const updateTurnContentInputSchema = z.object({
  turnId: z.string(),
  layer: z.string().default("presentation"),
  content: z.string(),
});

export const generationInfoInputSchema = z.object({
  turnId: z.string(),
});

export const generationInfoOutputSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string().nullable(),
  task: z.literal("turn_generation"),
  stepOrder: z.array(z.string()),
  prompts: z.record(
    z.string(),
    z.object({
      rendered: z.array(generationInfoMessageSchema),
      transformed: z.array(generationInfoMessageSchema).nullable(),
    })
  ),
  stepResponses: z.record(z.string(), generationInfoResponseSchema),
  capturedOutputs: z.record(z.string(), z.record(z.string(), z.unknown())),
  apiPayloads: z.record(z.string(), z.unknown()),
  stepMetadata: z.record(
    z.string(),
    z.object({
      idx: z.number(),
      name: z.string().nullable(),
      promptTemplateId: z.string().nullable(),
      promptTemplateName: z.string().nullable(),
      modelProfileId: z.string().nullable(),
      modelProfileName: z.string().nullable(),
      modelId: z.string().nullable(),
      hints: z.unknown().nullable(),
    })
  ),
  finalOutputs: z.record(z.string(), z.unknown()),
  meta: z.object({
    scenarioId: z.string(),
    participantId: z.string(),
    participantName: z.string(),
    intentId: z.string(),
    intentKind: intentKindSchema,
    intentConstraint: z.string().nullable(),
    turnId: z.string(),
    status: generationRunStatusSchema,
    startedAt: z.date(),
    finishedAt: z.date().nullable(),
    error: z.string().nullable(),
    effectSequence: z.number().nullable(),
    branchFromTurnId: z.string().nullable(),
  }),
});

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

// Branch preview/switch schemas
export const resolveLeafInputSchema = z.object({
  scenarioId: z.string(),
  fromTurnId: z.string(),
});
export const resolveLeafOutputSchema = z.object({ leafTurnId: z.string() });

export const switchTimelineInputSchema = z.object({
  scenarioId: z.string(),
  leafTurnId: z.string(),
});
export const switchTimelineOutputSchema = z.object({
  success: z.boolean(),
  newAnchorTurnId: z.string(),
});

// Type exports
export type IntentKind = z.infer<typeof intentKindSchema>;
export type IntentInput = z.infer<typeof intentInputSchema>;
export type EnvironmentInput = z.infer<typeof environmentInputSchema>;
export type EnvironmentOutput = z.infer<typeof environmentOutputSchema>;
export type LoadTimelineInput = z.infer<typeof loadTimelineInputSchema>;
export type LoadTimelineOutput = z.infer<typeof loadTimelineOutputSchema>;
export type TimelineTurn = z.infer<typeof timelineTurnSchema>;
export type AddTurnInput = z.infer<typeof addTurnInputSchema>;
export type AddTurnOutput = z.infer<typeof addTurnOutputSchema>;
export type UpdateTurnContentInput = z.infer<typeof updateTurnContentInputSchema>;
export type CreateIntentInput = z.infer<typeof createIntentInputSchema>;
export type CreateIntentOutput = z.infer<typeof createIntentOutputSchema>;
export type Intent = z.infer<typeof intentSchema>;
export type IntentStatus = z.infer<typeof intentStatusSchema>;
export type GenerationRunStatus = z.infer<typeof generationRunStatusSchema>;
export type IntentEffect = z.infer<typeof intentEffectSchema>;
export type IntentInterruptInput = z.infer<typeof intentInterruptInputSchema>;
export type IntentInterruptOutput = z.infer<typeof intentInterruptOutputSchema>;
export type ResolveLeafInput = z.infer<typeof resolveLeafInputSchema>;
export type ResolveLeafOutput = z.infer<typeof resolveLeafOutputSchema>;
export type SwitchTimelineInput = z.infer<typeof switchTimelineInputSchema>;
export type SwitchTimelineOutput = z.infer<typeof switchTimelineOutputSchema>;
export type GenerationInfoInput = z.infer<typeof generationInfoInputSchema>;
export type GenerationInfoOutput = z.infer<typeof generationInfoOutputSchema>;
