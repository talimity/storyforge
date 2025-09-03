import type { TurnGenSources } from "@storyforge/gentasks";
import {
  coerceNumber,
  coerceString,
} from "@/components/features/templates/recipes/param-coercion";
import type { RecipeDefinition } from "@/components/features/templates/types";

/**
 * Coerce format parameter for character display
 */
export function coerceFormat(v: unknown): "prose" | "bullets" {
  return v === "prose" || v === "bullets" ? v : "prose";
}

export const charactersRecipe: RecipeDefinition<
  "turn_generation",
  TurnGenSources
> = {
  id: "characters_basic",
  name: "Character Descriptions",
  task: "turn_generation",
  description:
    "This block lists each active character in the scenario, their description, and optionally their writing examples.",

  parameters: [
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
  ],

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

  toSlotSpec(params) {
    // TODO: Draft compiler should automatically coerce parameters and clamp to
    // the defaults/ranges specified in the recipe definition
    const maxChars = coerceNumber(params.maxChars, 6, 1, 20);
    const characterTemplate = coerceString(
      params.characterTemplate,
      "{{item.name}}: {{item.description}}"
    );
    const budget = coerceNumber(params.budget, 5000, 100);

    return {
      budget: { maxTokens: budget },
      meta: {},
      plan: [
        {
          kind: "forEach",
          source: { source: "characters", args: { limit: maxChars } },
          map: [{ kind: "message", role: "user", content: characterTemplate }],
        },
      ],
    };
  },
};
