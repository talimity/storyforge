import type { IntentKind } from "@storyforge/contracts";
import type { TurnGenSources } from "@storyforge/gentasks";
import { MESSAGE_ROLE_SELECT_OPTIONS } from "@/features/template-builder/services/builder-utils";
import type { RecipeDefinition } from "@/features/template-builder/types";
import { defineRecipe } from "@/features/template-builder/types";

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
  {
    key: "messageRole",
    label: "Message Role",
    type: "select",
    defaultValue: "user",
    options: MESSAGE_ROLE_SELECT_OPTIONS,
    help: "Message role used for the instruction prompts",
  },
] as const;

export const nextTurnIntentRecipe: RecipeDefinition<TurnGenSources, typeof params> = defineRecipe({
  id: "intent_basic",
  name: "Next Turn Guidance",
  description:
    "Instructs the model how to continue the scenario, based on the player's guidance prompt. Skipped if player didn't provide any guidance.",
  parameters: params,
  requires: ["globals"],
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
                  role: params.messageRole,
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
            { kind: "message", role: params.messageRole, content: params.narratorTemplate },
          ],
        },
      ],
    };
  },
});
