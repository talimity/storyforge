import type { IntentKind } from "@storyforge/contracts";
import type { NarrativeSources } from "@storyforge/gentasks";
import { MESSAGE_ROLE_SELECT_OPTIONS } from "@/features/template-builder/services/builder-utils";
import type {
  InferRecipeParams,
  RecipeDefinition,
  RecipeParamSpec,
} from "@/features/template-builder/types";
import { defineRecipe } from "@/features/template-builder/types";

const MAX_TURNS_PARAM = {
  key: "maxTurns",
  label: "Max Turns",
  type: "number",
  defaultValue: 50,
  min: 1,
  max: 9999,
  help: "Maximum number of turns to include; truncates oldest turns",
} as const;

const WINDOW_ENABLED_PARAM = {
  key: "chapterWindowEnabled",
  label: "Limit by Chapter",
  type: "toggle",
  defaultValue: false,
  help: "Limit turns to a relative chapter window.",
} as const satisfies RecipeParamSpec;

const WINDOW_START_PARAM = {
  key: "chapterWindowStartOffset",
  label: "Start Offset",
  type: "number",
  defaultValue: 0,
  help: "Relative chapter to start from (0 = current, -1 = previous, 1 = first chapter).",
  visibleWhen: (params: Record<string, unknown>) => Boolean(params.chapterWindowEnabled),
} as const satisfies RecipeParamSpec;

const WINDOW_END_PARAM = {
  key: "chapterWindowEndOffset",
  label: "End Offset",
  type: "number",
  defaultValue: 0,
  help: "Relative chapter to end on (inclusive).",
  visibleWhen: (params: Record<string, unknown>) => Boolean(params.chapterWindowEnabled),
} as const satisfies RecipeParamSpec;

const WINDOW_REQUIRE_MIN_TURNS_PARAM = {
  key: "chapterWindowRequireMinTurns",
  label: "Require Minimum Turns",
  type: "toggle",
  defaultValue: false,
  help: "Guarantee a minimum number of turns by expanding the window as needed.",
  visibleWhen: (params: Record<string, unknown>) => Boolean(params.chapterWindowEnabled),
} as const satisfies RecipeParamSpec;

const WINDOW_MIN_TURNS_PARAM = {
  key: "chapterWindowMinTurns",
  label: "Minimum Turn Count",
  type: "number",
  defaultValue: 30,
  min: 1,
  max: 9999,
  help: "Minimum number of turns to include. Older chapters are added if needed.",
  visibleWhen: (params: Record<string, unknown>) =>
    Boolean(params.chapterWindowEnabled && params.chapterWindowRequireMinTurns),
} as const satisfies RecipeParamSpec;

const CHAPTER_WINDOW_PARAMETERS = [
  WINDOW_ENABLED_PARAM,
  WINDOW_START_PARAM,
  WINDOW_END_PARAM,
  WINDOW_REQUIRE_MIN_TURNS_PARAM,
  WINDOW_MIN_TURNS_PARAM,
] as const;

type ChapterWindowParamValues = InferRecipeParams<typeof CHAPTER_WINDOW_PARAMETERS>;

function buildChapterWindowArgs(params: ChapterWindowParamValues, maxTurns?: number) {
  if (!params.chapterWindowEnabled) {
    return undefined;
  }

  const startOffset = Number.isFinite(params.chapterWindowStartOffset)
    ? Number(params.chapterWindowStartOffset)
    : 0;
  const endOffset = Number.isFinite(params.chapterWindowEndOffset)
    ? Number(params.chapterWindowEndOffset)
    : 0;

  const chapterWindow: { startOffset: number; endOffset: number; minTurns?: number } = {
    startOffset,
    endOffset,
  };

  if (params.chapterWindowRequireMinTurns) {
    const normalizedMaxTurns = Number.isFinite(maxTurns)
      ? Math.max(1, Math.floor(Number(maxTurns)))
      : undefined;
    const rawMinTurns = Number(params.chapterWindowMinTurns ?? 0);
    let minTurns = Number.isFinite(rawMinTurns) ? Math.max(1, Math.floor(rawMinTurns)) : 1;
    if (normalizedMaxTurns !== undefined) {
      minTurns = Math.min(minTurns, normalizedMaxTurns);
    }
    chapterWindow.minTurns = minTurns;
  }

  return { chapterWindow };
}

const basicParameters = [
  {
    key: "turnTemplate",
    label: "Turn Format",
    type: "template_string",
    defaultValue: "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}",
    help: "How each turn should be formatted",
  },
  {
    key: "messageRole",
    label: "Message Role",
    type: "select",
    defaultValue: "user",
    options: MESSAGE_ROLE_SELECT_OPTIONS,
    help: "Message role used for each turn entry",
  },
  MAX_TURNS_PARAM,
  ...CHAPTER_WINDOW_PARAMETERS,
] as const;

export const timelineBasicRecipe: RecipeDefinition<NarrativeSources, typeof basicParameters> =
  defineRecipe({
    id: "timeline_basic",
    name: "Timeline (Simple)",
    description: "Lists turns in chronological order.",
    parameters: basicParameters,
    requires: ["turns"],

    availableVariables: [
      {
        name: "item.turnNo",
        description: "The turn number in the scenario",
        example: "5",
      },
      {
        name: "item.chapterNumber",
        description: "The chapter number the turn belongs to",
        example: "2",
      },
      {
        name: "item.authorName",
        description: "Name of the character who authored this turn (or 'Narrator')",
        example: "Alice",
      },
      {
        name: "item.authorType",
        description: "Type of author (character or narrator)",
        example: "character",
      },
      {
        name: "item.content",
        description: "The text content of the turn",
        example: "She walked through the forest, listening to the birds.",
      },
    ],

    buildSlotLayout() {
      return {
        header: [{ kind: "anchor", key: "timeline_start" }],
        footer: [{ kind: "anchor", key: "timeline_end" }],
      };
    },

    toSlotSpec(params) {
      const chapterArgs = buildChapterWindowArgs(params, params.maxTurns);

      return {
        meta: {},
        plan: [
          {
            kind: "forEach",
            // Iterate turns array from newest to oldest (source default), but
            // fill from bottom up (prepend). This ensures timeline is presented
            // to the model in chronological order, while favoring recent turns
            // when maxTurns or budget limits require truncation.
            source: { source: "turns", ...(chapterArgs ? { args: chapterArgs } : {}) },
            limit: params.maxTurns,
            fillDir: "prepend",
            map: [
              { kind: "anchor", key: "turn_{{item.turnNo}}_before" },
              { kind: "message", role: params.messageRole, content: params.turnTemplate },
              { kind: "anchor", key: "turn_{{item.turnNo}}" },
            ],
          },
        ],
      };
    },
  });

const advancedParameters = [
  {
    key: "intentTemplate",
    label: "Turn Guidance Format (User)",
    type: "template_string",
    defaultValue: "[Turn {{item.turnNo}}] {{item.authorName}}\n{{item.intentPrompt}}]",
    help: "How to format each turn's guidance",
    infoTip:
      "This shows the model see the player input for past turns, which can help establish a pattern of instruction-following behavior.",
  },
  {
    key: "turnTemplate",
    label: "Turn Result Format (Assistant)",
    type: "template_string",
    defaultValue: "-> {{item.authorName}}: {{item.content}}",
    help: "How to format each generated turn",
    infoTip: "Uses the assistant role.",
  },
  {
    key: "manualTurnTemplate",
    label: "Player Turn Format",
    type: "template_string",
    defaultValue:
      "[Turn {{item.turnNo}}] {{item.authorName}}\nI'll write this turn myself.\n-> {{item.authorName}}: {{item.content}}",
    help: "How to format turns written by the player",
    infoTip:
      "This applies to turns using the 'Control' intent, or which were inserted manually without triggering any model generation.",
  },
  {
    key: "useAssistantForUnguidedTurns",
    label: "Use Assistant Template for Unguided Turns",
    type: "toggle",
    defaultValue: false,
    help: "For turns that do not have any guidance, use the Turn Result Format (Assistant) instead of Player Turn.",
  },
  MAX_TURNS_PARAM,
  ...CHAPTER_WINDOW_PARAMETERS,
] as const;

export const timelineAdvancedRecipe: RecipeDefinition<NarrativeSources, typeof advancedParameters> =
  defineRecipe({
    id: "timeline_advanced",
    name: "Timeline (Advanced)",
    description:
      "Lists turns in chronological order, and includes the player's guidance prompt before each turn.",
    parameters: advancedParameters,
    requires: ["turns"],

    buildSlotLayout() {
      return {
        header: [{ kind: "anchor", key: "timeline_start" }],
        footer: [{ kind: "anchor", key: "timeline_end" }],
      };
    },

    toSlotSpec(params: InferRecipeParams<typeof advancedParameters>) {
      const chapterArgs = buildChapterWindowArgs(params, params.maxTurns);

      return {
        meta: {},
        plan: [
          {
            kind: "forEach",
            source: { source: "turns", ...(chapterArgs ? { args: chapterArgs } : {}) },
            limit: params.maxTurns,
            fillDir: "prepend",
            map: [
              // Place turn start anchor
              { kind: "anchor", key: "turn_{{item.turnNo}}_before" },
              // Determine which templates to use based on intent kind
              {
                kind: "if",
                when: { type: "nonEmpty", ref: { source: "$item", args: { path: "intentKind" } } },
                then: [
                  // Intent present, check for 'manual_control' intent
                  {
                    kind: "if",
                    when: {
                      type: "eq",
                      ref: { source: "$item", args: { path: "intentKind" } },
                      // conditionref `value` does not check type against the ref
                      // so we need to manually ensure literal is valid here
                      value: "manual_control" satisfies IntentKind,
                    },
                    then: [
                      // Control intent = use manual template
                      { kind: "message", role: "user", content: params.manualTurnTemplate },
                    ],
                    else: [
                      // Some other intent = use the intent/response templates
                      { kind: "message", role: "user", content: params.intentTemplate },
                      { kind: "message", role: "assistant", content: params.turnTemplate },
                    ],
                  },
                ],
                else: [
                  // No intent = manually inserted turn
                  // If useAssistantForUnguidedTurns is enabled, use the intent/response templates
                  ...(params.useAssistantForUnguidedTurns
                    ? [
                        { kind: "message", role: "user", content: params.intentTemplate } as const,
                        {
                          kind: "message",
                          role: "assistant",
                          content: params.turnTemplate,
                        } as const,
                      ]
                    : ([
                        { kind: "message", role: "user", content: params.manualTurnTemplate },
                      ] as const)),
                ],
              },
              // Place turn end anchor
              { kind: "anchor", key: "turn_{{item.turnNo}}" },
            ],
          },
        ],
      };
    },
  });
