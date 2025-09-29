import type { ChatCompletionMessage, ChatCompletionResponse } from "@storyforge/inference";
import { timelineStateSchema } from "@storyforge/timeline-events";
import { z } from "zod";
import { intentKindSchema, intentStatusSchema } from "./intents.js";
import { timelineEventSchema } from "./timeline-events.js";

export const queryTimelineInputSchema = z.object({
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
  provenance: z
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
  events: z.array(timelineEventSchema),
});
export const queryTimelineOutputSchema = z.object({
  timeline: z.array(timelineTurnSchema).describe("Array of turns in the loaded timeline slice"),
  cursors: z.object({
    nextCursor: z.string().nullable().describe("Cursor for the next page of turns, if any"),
  }),
  timelineLength: z.number().describe("Number of turns in the timeline from root to the leaf"),
});

// Turn content
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

// State
export const timelineStateInputSchema = z.object({
  scenarioId: z.string(),
  atTurnId: z
    .string()
    .nullish()
    .describe(
      "Specifies the leaf turn for which state should be derived; defaults to scenario's anchor turn"
    ),
  // TODO: implement reducing part of state
  // forConcerns: z
  //   .array(z.string())
  //   .optional()
  //   .describe("Concerns to include in the state; defaults to all"),
});
export const timelineStateOutputSchema = z.object({
  state: timelineStateSchema.describe(
    "Derived state of the timeline at the specified turn, keyed by concern"
  ),
});

// Gen info
export const generationRunStatusSchema = z.enum(["running", "finished", "error", "cancelled"]);
export const generationInfoMessageSchema = z.custom<ChatCompletionMessage>().meta({
  description: "A message from the generation run",
});
export const generationInfoResponseSchema = z.custom<ChatCompletionResponse>().meta({
  description: "A response from the generation run",
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

export type LoadTimelineInput = z.infer<typeof queryTimelineInputSchema>;
export type LoadTimelineOutput = z.infer<typeof queryTimelineOutputSchema>;
export type TimelineTurn = z.infer<typeof timelineTurnSchema>;
export type AddTurnInput = z.infer<typeof addTurnInputSchema>;
export type AddTurnOutput = z.infer<typeof addTurnOutputSchema>;
export type UpdateTurnContentInput = z.infer<typeof updateTurnContentInputSchema>;
export type ResolveLeafInput = z.infer<typeof resolveLeafInputSchema>;
export type ResolveLeafOutput = z.infer<typeof resolveLeafOutputSchema>;
export type SwitchTimelineInput = z.infer<typeof switchTimelineInputSchema>;
export type SwitchTimelineOutput = z.infer<typeof switchTimelineOutputSchema>;
export type GenerationRunStatus = z.infer<typeof generationRunStatusSchema>;
export type GenerationInfoInput = z.infer<typeof generationInfoInputSchema>;
export type GenerationInfoOutput = z.infer<typeof generationInfoOutputSchema>;
