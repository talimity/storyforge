import {
  coerceNumber,
  coerceOrder,
  coerceString,
} from "@/components/features/templates/recipes/param-coercion";
import type { RecipeDefinition } from "@/components/features/templates/recipes/registry";

/**
 * Coerce format parameter for character display
 */
export function coerceFormat(v: unknown): "prose" | "bullets" {
  return v === "prose" || v === "bullets" ? v : "prose";
}

export const charactersRecipe: RecipeDefinition = {
  id: "characters_basic",
  name: "Character Descriptions",
  task: "turn_generation",
  description:
    "Includes character descriptions and optionally examples for context",

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
      key: "order",
      label: "Order",
      type: "select",
      defaultValue: "asc",
      options: [
        { label: "Alphabetical (A-Z)", value: "asc" },
        { label: "Reverse Alphabetical (Z-A)", value: "desc" },
      ],
      help: "Order of characters by name",
    },
    {
      key: "format",
      label: "Format",
      type: "select",
      defaultValue: "prose",
      options: [
        { label: "Prose Description", value: "prose" },
        { label: "Bullet Points", value: "bullets" },
      ],
      help: "How to format each character entry",
    },
    {
      key: "characterTemplate",
      label: "Character Format",
      type: "template_string",
      defaultValue: "{{item.name}} — {{item.description}}",
      help: "Template for how each character should be formatted",
    },
    {
      key: "budget",
      label: "Token Budget",
      type: "number",
      defaultValue: 600,
      min: 100,
      max: 2000,
      help: "Maximum tokens to allocate for this slot",
    },
  ],

  availableVariables: [
    {
      name: "item.id",
      description: "Unique identifier for the character",
      example: "char_001",
    },
    {
      name: "item.name",
      description: "The character's name",
      example: "Aria Windwhisper",
    },
    {
      name: "item.description",
      description: "The character's full description and personality",
      example: "A wise elven mage with a mysterious past...",
    },
  ],

  toSlotSpec(params) {
    const maxChars = coerceNumber(params.maxChars, 6, 1, 20);
    const order = coerceOrder(params.order, "asc");
    const format = coerceFormat(params.format);
    const characterTemplate = coerceString(
      params.characterTemplate,
      "{{item.name}} — {{item.description}}"
    );
    const budget = coerceNumber(params.budget, 600, 100, 2000);

    // Build the content template based on format preference
    let contentTemplate = characterTemplate;
    if (format === "bullets") {
      contentTemplate = `• ${characterTemplate}`;
    }

    return {
      priority: 1, // Characters usually come after timeline
      budget: { maxTokens: budget },
      meta: {},
      plan: [
        {
          kind: "forEach",
          source: {
            source: "characters",
            args: { order, limit: maxChars },
          },
          map: [
            {
              kind: "message",
              role: "user",
              content: contentTemplate,
            },
          ],
          budget: { maxTokens: budget },
          stopWhenOutOfBudget: true,
        },
      ],
    };
  },
};
