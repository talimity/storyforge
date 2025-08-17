import z from "zod";

// Bootstrap API schemas
export const bootstrapInputSchema = z.object({
  scenarioId: z.string(),
});

export const bootstrapOutputSchema = z.object({
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
  // TODO: anchor turn is maybe burdensome for clients. server can technically
  // walk the tree down from any leaf to find that branch's anchor
  anchorTurnId: z
    .string()
    .describe("Final turn in this timeline; identifies a timeline branch"),
  leafTurnId: z
    .string()
    .optional()
    .describe("Cursor position of this timeline slice (defaults to anchor)"),
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
  authorParticipantId: z
    .string()
    .describe("Participant ID of the author of this turn"),
  swipes: z
    .object({
      leftTurnId: z
        .string()
        .nullable()
        .describe("Previous sibling turn, forking left"),
      rightTurnId: z
        .string()
        .nullable()
        .describe("Next sibling turn, forking right"),
      swipeCount: z
        .number()
        .describe("Sibling count for this turn, including itself"),
      swipeIndex: z.number().describe("Index of this turn among its siblings"),
    })
    .describe("Swipe (alternate branch) information for this turn"),
  depthFromAnchor: z
    .number()
    .describe("Depth of this turn from the anchor (0 for the anchor turn)"),
  chapterTurnNumber: z
    .number()
    .describe("Turn number within the chapter, starting at 1"),
  layer: z.literal("presentation").describe("The content layer being loaded"),
  content: z
    .object({ text: z.string(), createdAt: z.string(), updatedAt: z.string() })
    .describe("Content for this turn in the specified layer"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const loadTimelineOutputSchema = z.object({
  timeline: z
    .array(timelineTurnSchema)
    .describe("Array of turns in the loaded timeline slice"),
  cursors: z.object({
    nextLeafTurnId: z
      .string()
      .nullable()
      .describe("Cursor for the next page of turns, if any"),
  }),
  timelineDepth: z
    .number()
    .describe("Number of turns in the timeline from root to anchor"),
});

// Intent API schemas
export const createIntentInputSchema = z.object({
  scenarioId: z.string(),
  // todo: maybe this should be object union instead of mode with dependent fields
  mode: z
    .enum(["direct_control", "story_constraint", "quick_action"])
    .default("direct_control")
    .describe("Player's chosen mode of interaction"),
  text: z
    .string()
    .min(1)
    .max(20000)
    .optional()
    .describe(
      "Player's input or prompt (required for direct_control and quick_action modes"
    ),
  selectedParticipantId: z.string().optional(),
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

export const intentEffectSchema = z
  .object({
    turnId: z.string().describe("ID of the turn created by this effect"),
    sequence: z
      .number()
      .describe("Order of this effect among all effects in the intent"),
  })
  .describe("Representation of an effect of player's intent (ie. new turns)");

export const intentSchema = z
  .object({
    id: z.string(),
    scenarioId: z.string(),
    status: z
      .enum(["pending", "applied", "failed"])
      .describe("Current status of intent"),
    effects: z
      .array(intentEffectSchema)
      .describe("Array of effects created by this intent"),
    anchorTurnId: z
      .string()
      .describe("Timeline anchor turn when this intent was created"),
  })
  .describe("Representation of a player's intent to influence the story");

export const createIntentOutputSchema = z.object({ intent: intentSchema });

// Intent progress schemas
export const intentProgressInputSchema = z.object({ intentId: z.string() });

export const intentResultInputSchema = z.object({ intentId: z.string() });
export const intentResultOutputSchema = intentSchema;

// Type exports
export type BootstrapInput = z.infer<typeof bootstrapInputSchema>;
export type BootstrapOutput = z.infer<typeof bootstrapOutputSchema>;
export type LoadTimelineInput = z.infer<typeof loadTimelineInputSchema>;
export type LoadTimelineOutput = z.infer<typeof loadTimelineOutputSchema>;
export type TimelineTurn = z.infer<typeof timelineTurnSchema>;
export type CreateIntentInput = z.infer<typeof createIntentInputSchema>;
export type CreateIntentOutput = z.infer<typeof createIntentOutputSchema>;
export type Intent = z.infer<typeof intentSchema>;
export type IntentEffect = z.infer<typeof intentEffectSchema>;
