import { z } from "zod";

export const intentKindSchema = z.enum([
  "manual_control",
  "guided_control",
  "narrative_constraint",
  "continue_story",
]);

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
  chapters: z
    .array(
      z.object({
        id: z.string(),
        index: z.number(),
        title: z.string().nullable(),
      })
    )
    .describe("Chapters in the scenario, in order"),
  generatingIntent: z
    .lazy(() => intentSchema)
    .nullable()
    .describe("Currently generating intent, if any"),
});

// Timeline API schemas
export const loadTimelineInputSchema = z.object({
  scenarioId: z.string(),
  cursor: z
    .string()
    .optional()
    .describe("ID of leaf turn of this timeline slice (defaults to anchor)"),
  windowSize: z
    .number()
    .min(1)
    .max(20)
    .describe("Number of turns to load, starting from the leaf turn"),
  layer: z
    .string()
    .optional()
    .default("presentation")
    .describe("Content layer to load for each turn"),
});

export const timelineTurnSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  chapterId: z.string(),
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
});

export const loadTimelineOutputSchema = z.object({
  timeline: z.array(timelineTurnSchema).describe("Array of turns in the loaded timeline slice"),
  cursors: z.object({
    nextLeafTurnId: z.string().nullable().describe("Cursor for the next page of turns, if any"),
  }),
  timelineDepth: z.number().describe("Number of turns in the timeline from root to anchor"),
});

// Intent API schemas
export const createIntentInputSchema = z.object({
  scenarioId: z.string(),
  parameters: intentInputSchema,
  // TODO: still need to think through these modes more
  // constraint: z
  //   .object({
  //     type: z.enum(["plot", "character", "tone", "pace"]),
  //     strength: z.number().min(0).max(100).default(50),
  //   })
  //   .optional(),
  // quickAction: z
  //   .object({
  //     type: z.enum(["plot_twist", "surprise_me", "jump_ahead", "focus_on"]),
  //     targetCharacterId: z.string().optional(),
  //   })
  //   .optional(),
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
    status: z
      .enum(["pending", "running", "finished", "failed", "cancelled"])
      .describe("Current status of intent"),
    effects: z.array(intentEffectSchema).describe("Array of effects created by this intent"),
    anchorTurnId: z.string().describe("Timeline anchor turn when this intent was created"),
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
export type EnvironmentInput = z.infer<typeof environmentInputSchema>;
export type EnvironmentOutput = z.infer<typeof environmentOutputSchema>;
export type LoadTimelineInput = z.infer<typeof loadTimelineInputSchema>;
export type LoadTimelineOutput = z.infer<typeof loadTimelineOutputSchema>;
export type TimelineTurn = z.infer<typeof timelineTurnSchema>;
export type CreateIntentInput = z.infer<typeof createIntentInputSchema>;
export type CreateIntentOutput = z.infer<typeof createIntentOutputSchema>;
export type Intent = z.infer<typeof intentSchema>;
export type IntentEffect = z.infer<typeof intentEffectSchema>;
export type IntentInterruptInput = z.infer<typeof intentInterruptInputSchema>;
export type IntentInterruptOutput = z.infer<typeof intentInterruptOutputSchema>;
