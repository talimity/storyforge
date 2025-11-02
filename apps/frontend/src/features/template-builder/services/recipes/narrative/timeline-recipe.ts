import type { IntentKind } from "@storyforge/contracts";
import type { NarrativeSourcesBase } from "@storyforge/gentasks";
import type { InferRecipeParams, RecipeDefinition } from "@/features/template-builder/types";
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
const TOKEN_BUDGET_PARAM = {
  key: "budget",
  label: "Token Budget",
  type: "number",
  defaultValue: 32768,
  min: 1024,
  max: Number.MAX_SAFE_INTEGER,
  help: "Maximum tokens to allow for turn content; truncates oldest turns",
} as const;

const basicParameters = [
  {
    key: "turnTemplate",
    label: "Turn Format",
    type: "template_string",
    defaultValue: "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}",
    help: "How each turn should be formatted",
  },
  MAX_TURNS_PARAM,
  TOKEN_BUDGET_PARAM,
] as const;

export const timelineBasicRecipe: RecipeDefinition<NarrativeSourcesBase, typeof basicParameters> =
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
      return {
        budget: { maxTokens: params.budget },
        meta: {},
        plan: [
          {
            kind: "forEach",
            source: { source: "turns", args: { order: "desc", limit: params.maxTurns } },
            fillDir: "prepend",
            map: [
              { kind: "message", role: "user", content: params.turnTemplate },
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
  TOKEN_BUDGET_PARAM,
] as const;

export const timelineAdvancedRecipe: RecipeDefinition<
  NarrativeSourcesBase,
  typeof advancedParameters
> = defineRecipe({
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
    return {
      budget: { maxTokens: params.budget },
      meta: {},
      plan: [
        {
          kind: "forEach",
          // Iterate turns array from newest to oldest (Turn# desc), but fill from bottom up (prepend)
          // This ensures timeline is in chrono order, but that we stop prepending older turns once
          // we hit budget limits.
          source: { source: "turns", args: { order: "desc", limit: params.maxTurns } },
          fillDir: "prepend",
          map: [
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
                      { kind: "message", role: "assistant", content: params.turnTemplate } as const,
                    ]
                  : ([
                      { kind: "message", role: "user", content: params.manualTurnTemplate },
                    ] as const)),
              ],
            },
            { kind: "anchor", key: "turn_{{item.turnNo}}" },
          ],
        },
      ],
    };
  },
});
