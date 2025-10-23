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
      "Remember, Narrator can't take actions for other characters. Only control NPCs or descriptive events during this turn.",
    help: "Extra instruction when generating a Narrator turn",
  },
] as const;

export const nextTurnIntentRecipe: RecipeDefinition<
  "turn_generation",
  TurnGenSources,
  typeof params
> = {
  id: "intent_basic",
  name: "Next Turn Guidance",
  task: "turn_generation",
  description:
    "Instructs the model how to continue the scenario, based on the player's guidance prompt. Skipped if player didn't provide any guidance.",
  parameters: params,
  toSlotSpec(params) {
    return {
      meta: {},
      plan: [
        {
          kind: "if",
          when: {
            ref: { source: "$ctx", args: { path: "currentIntent.kind" } },
            type: "nonEmpty",
          },
          then: [
            {
              kind: "if",
              when: {
                ref: { source: "$ctx", args: { path: "currentIntent.kind" } },
                type: "eq",
                value: "manual_control" satisfies IntentKind,
              },
              then: [
                // Don't output anything for manual control intent
              ],
              else: [
                {
                  kind: "message",
                  role: "user",
                  content: params.currentIntentTemplate,
                  // only include if prompt is non-empty
                  when: [
                    {
                      ref: { source: "$ctx", args: { path: "currentIntent.prompt" } },
                      type: "nonEmpty",
                    },
                  ],
                },
              ],
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
