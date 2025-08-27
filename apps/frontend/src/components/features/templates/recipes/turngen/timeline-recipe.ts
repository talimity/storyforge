import type { RecipeDefinition } from "../contract";
import { coerceNumber, coerceOrder, coerceString } from "../param-coercion";

export const timelineRecipe: RecipeDefinition = {
  id: "timeline_basic",
  name: "Timeline",
  task: "turn_generation",
  description:
    "Shows turns from the scenario's timeline, in chronological order",

  parameters: [
    {
      key: "maxTurns",
      label: "Max Turns",
      type: "number",
      defaultValue: 8,
      min: 1,
      max: 20,
      help: "Maximum number of turns to include",
    },
    {
      key: "order",
      label: "Order",
      type: "select",
      defaultValue: "desc",
      options: [
        { label: "Newest First", value: "desc" },
        { label: "Oldest First", value: "asc" },
      ],
      help: "Order of turns in the timeline",
    },
    {
      key: "turnTemplate",
      label: "Turn Format",
      type: "template_string",
      defaultValue: "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}",
      help: "Template for how each turn should be formatted",
    },
    {
      key: "budget",
      label: "Token Budget",
      type: "number",
      defaultValue: 900,
      min: 100,
      max: 2000,
      help: "Maximum tokens to allocate for this slot",
    },
  ],

  availableVariables: [
    {
      name: "item.turnNo",
      description: "The turn number in the scenario",
      example: "5",
    },
    {
      name: "item.authorName",
      description: "Name of the character or narrator who created this turn",
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
    const maxTurns = coerceNumber(params.maxTurns, 8, 1, 20);
    const order = coerceOrder(params.order, "desc");
    const turnTemplate = coerceString(
      params.turnTemplate,
      "[{{item.turnNo}}] {{item.authorName}}: {{item.content}}"
    );
    const budget = coerceNumber(params.budget, 900, 100, 2000);

    return {
      priority: 0, // Timeline usually has high priority
      budget: { maxTokens: budget },
      plan: [
        {
          kind: "forEach",
          source: {
            source: "turns",
            args: { order, limit: maxTurns },
          },
          map: [
            {
              kind: "message",
              role: "user",
              content: turnTemplate,
            },
          ],
          budget: { maxTokens: budget },
          stopWhenOutOfBudget: true,
        },
      ],
    };
  },
};
