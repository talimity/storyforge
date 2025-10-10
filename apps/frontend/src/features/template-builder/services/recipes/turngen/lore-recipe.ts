import type { TurnGenSources } from "@storyforge/gentasks";
import type { RecipeDefinition } from "@/features/template-builder/types";

const POSITION_OPTIONS = [
  { label: "First Section", value: "before_char" },
  { label: "Second Section", value: "after_char" },
] as const;

const ROLE_OPTIONS = [
  { label: "System", value: "system" },
  { label: "User", value: "user" },
  { label: "Assistant", value: "assistant" },
] as const;

const PARAMETERS = [
  {
    key: "position",
    label: "Lore Section",
    type: "select",
    defaultValue: POSITION_OPTIONS[0].value,
    options: POSITION_OPTIONS,
    help: "Which lore section to pull entries from.",
  },
  {
    key: "entryTemplate",
    label: "Entry Format",
    type: "template_string",
    defaultValue: "• {{item.content}}",
    help: "Template applied to each activated lore entry.",
  },
  {
    key: "role",
    label: "Message Role",
    type: "select",
    defaultValue: ROLE_OPTIONS[0].value,
    options: ROLE_OPTIONS,
    help: "Message role used when inserting lore entries into the prompt.",
  },
] as const;

export const loreEntriesRecipe: RecipeDefinition<
  "turn_generation",
  TurnGenSources,
  typeof PARAMETERS
> = {
  id: "lore_basic",
  name: "Activated Lore Entries",
  task: "turn_generation",
  description: "Includes activated entries from any lorebooks in the scenario.",
  parameters: PARAMETERS,
  availableVariables: [
    {
      name: "item.content",
      description: "Full lore entry text.",
      example: "The Argent Rose order traces its lineage to the First Bloom.",
    },
    {
      name: "item.name",
      description: "Optional lore entry name, if defined in the lorebook.",
      example: "Argent Rose Origins",
    },
    {
      name: "item.comment",
      description: "Optional designer comment associated with the lore entry.",
      example: "Use sparingly to avoid repetition.",
    },
  ],

  toSlotSpec(params) {
    const args: TurnGenSources["lore"]["args"] = {
      position: params.position,
    };

    // if (Number.isFinite(params.maxEntries) && params.maxEntries > 0) {
    //   args.limit = Math.floor(params.maxEntries);
    // }

    return {
      meta: {},
      plan: [
        {
          kind: "forEach",
          source: { source: "lore", args },
          map: [
            {
              kind: "message",
              role: params.role,
              content: params.entryTemplate,
            },
          ],
        },
      ],
    };
  },
};
