import type { NarrativeSources } from "@storyforge/gentasks";
import { MESSAGE_ROLE_SELECT_OPTIONS } from "@/features/template-builder/services/builder-utils";
import type { RecipeDefinition } from "@/features/template-builder/types";
import { defineRecipe } from "@/features/template-builder/types";

const parameters = [
  {
    key: "maxSummaries",
    label: "Max Summaries",
    type: "number",
    defaultValue: 20,
    min: 1,
    max: 999,
    help: "Maximum number of chapter summaries to include.",
  },
  {
    key: "messageRole",
    label: "Message Role",
    type: "select",
    defaultValue: "user",
    options: MESSAGE_ROLE_SELECT_OPTIONS,
    help: "Message role used for each chapter summary.",
  },
  {
    key: "summaryTemplate",
    label: "Summary Format",
    type: "template_string",
    defaultValue:
      "{{#if item.title}}[Ch.{{item.chapterNumber}} - {{item.title}}]{{#else}}[Chapter {{item.chapterNumber}}]{{#endif}}\n{{#if item.summaryText}}{{item.summaryText}}{{#else}}No summary available.{{#endif}}\n",
    help: "Template for each chapter summary message.",
  },
] as const;

export const chapterSummariesRecipe: RecipeDefinition<NarrativeSources, typeof parameters> =
  defineRecipe({
    id: "chapter_summaries_basic",
    name: "Chapter Summaries",
    description: "Lists summaries for earlier chapters in the scenario.",
    parameters,
    requires: ["chapterSummaries"],

    availableVariables: [
      { name: "item.chapterNumber", description: "Chapter number for the summary", example: "4" },
      { name: "item.title", description: "Title of the chapter, if any", example: "Stormbound" },
      {
        name: "item.summaryText",
        description: "Short narrative summary of the chapter",
        example: "Our heroes regrouped in the port town after the disastrous raid.",
      },
      {
        name: "item.updatedAt",
        description: "Last updated timestamp for the summary",
        example: "",
      },
    ],

    toSlotSpec(params) {
      return {
        meta: {},
        plan: [
          {
            kind: "forEach",
            source: { source: "chapterSummaries" },
            fillDir: "prepend",
            limit: params.maxSummaries,
            map: [
              {
                kind: "message",
                role: params.messageRole,
                content: params.summaryTemplate,
              },
            ],
          },
        ],
      };
    },
  });
