import type { TurnGenSources } from "@storyforge/gentasks";
import type { RecipeDefinition } from "@/features/template-builder/types";

const parameters = [
  {
    key: "turnTemplate",
    label: "Turn Format",
    type: "template_string",
    defaultValue: "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}",
    help: "Template for how each turn should be formatted",
  },
  {
    key: "maxTurns",
    label: "Max Turns",
    type: "number",
    defaultValue: 50,
    min: 1,
    max: 9999,
    help: "Maximum number of turns to include; truncates oldest turns",
  },
  {
    key: "budget",
    label: "Token Budget",
    type: "number",
    defaultValue: 32768,
    min: 1024,
    max: Number.MAX_SAFE_INTEGER,
    help: "Maximum tokens to allow for turn content; truncates oldest turns",
  },
] as const;

export const timelineRecipe: RecipeDefinition<
  "turn_generation",
  TurnGenSources,
  typeof parameters
> = {
  id: "timeline_basic",
  name: "Timeline",
  task: "turn_generation",
  description:
    "Lists turns from the scenario's timeline in chronological order.",
  parameters,

  availableVariables: [
    {
      name: "item.turnNo",
      description: "The turn number in the scenario",
      example: "5",
    },
    {
      name: "item.authorName",
      description:
        "Name of the character who authored this turn (or 'Narrator')",
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

  toSlotSpec(params) {
    return {
      budget: { maxTokens: params.budget },
      meta: {},
      plan: [
        {
          kind: "forEach",
          source: {
            source: "turns",
            args: { order: "asc", limit: params.maxTurns },
          },
          map: [
            {
              kind: "message",
              role: "user",
              content: params.turnTemplate,
            },
          ],
        },
      ],
    };
  },
};
