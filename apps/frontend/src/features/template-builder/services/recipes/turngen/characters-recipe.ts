import type { TurnGenSources } from "@storyforge/gentasks";
import type { RecipeDefinition } from "@/features/template-builder/types";

const parameters = [
  {
    key: "maxChars",
    label: "Max Characters",
    type: "number",
    defaultValue: 6,
    min: 1,
    max: 20,
    help: "Maximum number of characters to include",
  },
  {
    key: "role",
    label: "Message Role",
    type: "select",
    defaultValue: "user",
    options: [
      { label: "User", value: "user" },
      { label: "Assistant", value: "assistant" },
      { label: "System", value: "system" },
    ],
    help: "Message role used for each character entry",
  },
  {
    key: "characterTemplate",
    label: "Character Format",
    type: "template_string",
    defaultValue: "## {{item.name}}\n\n{{item.description}}",
    help: "Template for how each character entry should be formatted",
  },
  {
    key: "budget",
    label: "Max Tokens",
    type: "number",
    defaultValue: 5000,
    min: 100,
    help: "Block will stop adding character entries when this limit is reached",
  },
] as const;

export const charactersRecipe: RecipeDefinition<
  "turn_generation",
  TurnGenSources,
  typeof parameters
> = {
  id: "characters_basic",
  name: "Character Descriptions",
  task: "turn_generation",
  description:
    "Lists each active character in the scenario, their description, and optionally their writing examples.",
  parameters,

  // TODO: Can we get runtime type information for the referenced datasource so
  // these variables can be auto-generated?
  availableVariables: [
    {
      name: "item.id",
      description: "Unique identifier for the character",
      example: "char_001",
    },
    {
      name: "item.name",
      description: "The character's name",
      example: "Elaina",
    },
    {
      name: "item.description",
      description: "The character's full description and personality",
      example:
        "A prodigal young witch who travels the world while keeping a riveting log of her own adventures...",
    },
  ],

  buildSlotLayout() {
    return {
      header: [{ kind: "anchor", key: "character_definitions_start" }],
      footer: [{ kind: "anchor", key: "character_definitions_end" }],
    };
  },

  toSlotSpec(params) {
    return {
      budget: { maxTokens: params.budget },
      meta: {},
      plan: [
        {
          kind: "forEach",
          source: {
            source: "characters",
            args: { limit: params.maxChars },
          },
          map: [
            {
              kind: "if",
              when: { type: "nonEmpty", ref: { source: "$item", args: { path: "description" } } },
              then: [
                {
                  kind: "message",
                  role: params.role,
                  content: params.characterTemplate,
                },
              ],
            },
          ],
        },
      ],
    };
  },
};
