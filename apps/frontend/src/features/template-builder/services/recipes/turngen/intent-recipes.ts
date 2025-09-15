import type { IntentKind } from "@storyforge/contracts";
import type { TurnGenSources } from "@storyforge/gentasks";
import type { RecipeDefinition } from "@/features/template-builder/types";

const params = [
  {
    key: "currentIntentTemplate",
    label: "Instruction Prompt",
    type: "template_string",
    defaultValue: "{{currentIntent.prompt}}",
    help: "How to format each turn's guidance",
  },
  {
    key: "narratorTemplate",
    label: "Narrator Extra Prompt",
    type: "template_string",
    defaultValue:
      "The Narrator must not take actions on the behalf of other characters; only control NPCs or descriptive events.",
    help: "Extra instruction when generating a Narrator turn",
  },
] as const;

export const nextTurnIntentRecipe: RecipeDefinition<
  "turn_generation",
  TurnGenSources,
  typeof params
> = {
  id: "intent_basic",
  name: "Next Turn Intent",
  task: "turn_generation",
  description:
    "Tells the model how to generate the next turn based on the player's intent input. Skipped if the player has not provided any input.",
  parameters: params,
  toSlotSpec(params) {
    return {
      meta: {},
      plan: [
        {
          kind: "if",
          when: { ref: { source: "$ctx", args: { path: "currentIntent.kind" } }, type: "nonEmpty" },
          then: [
            {
              kind: "if",
              when: makeIntentCase("manual_control"),
              then: [
                // Don't output anything for manual control intent
              ],
              else: [{ kind: "message", role: "user", content: params.currentIntentTemplate }],
            },
          ],
        },
        {
          kind: "if",
          when: {
            ref: { source: "$globals", args: { path: "isNarratorTurn" } },
            type: "eq",
            value: true,
          },
          then: [
            // append narrator prompt
            { kind: "message", role: "user", content: params.narratorTemplate },
          ],
        },
      ],
    };
  },
};

function makeIntentCase(kind: IntentKind) {
  return {
    ref: { source: "$ctx", args: { path: "currentIntent.kind" } },
    type: "eq",
    value: kind,
  } as const;
}
