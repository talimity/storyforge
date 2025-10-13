import type {
  PromptTemplate,
  SourceHandlerMap,
  SourceRegistry,
} from "@storyforge/prompt-rendering";
import { makeRegistry } from "@storyforge/prompt-rendering";
import { exactKeys } from "@storyforge/utils";
import type { RuntimeSourceSpec } from "../types.js";

// Writing assistant context
export type WritingAssistantCtx = {
  userText: string;
  context: string[];
  stylePrefs?: {
    styleGuide?: string;
    tone?: string;
    [key: string]: unknown;
  };
  globals?: Record<string, unknown>;
};

// Source specification for writing assistant
export type WritingAssistantSources = {
  userText: {
    args: never;
    out: string;
  };
  context: {
    args: never;
    out: string[];
  };
  stylePrefs: {
    args: never;
    out: Record<string, unknown> | undefined;
  };
  globals: {
    args: never;
    out: Record<string, unknown> | undefined;
  };
  styleGuide: {
    args: never;
    out: string | undefined;
  };
  tone: {
    args: never;
    out: string | undefined;
  };
};

// Convenience type aliases
export type WritingAssistantTemplate = PromptTemplate<
  "writing_assistant",
  WritingAssistantSources & RuntimeSourceSpec
>;
export type WritingAssistantRegistry = SourceRegistry<WritingAssistantCtx, WritingAssistantSources>;

const makeWritingAssistRegistry = (
  handlers: SourceHandlerMap<WritingAssistantCtx, WritingAssistantSources>
) => makeRegistry<WritingAssistantCtx, WritingAssistantSources>(handlers);

export const writingAssistRegistry = makeWritingAssistRegistry({
  userText: (_ref, ctx) => ctx.userText,
  context: (_ref, ctx) => ctx.context,
  stylePrefs: (_ref, ctx) => ctx.stylePrefs,
  globals: (_ref, ctx) => ctx.globals,
  styleGuide: (_ref, ctx) => (ctx.stylePrefs ? ctx.stylePrefs.styleGuide : undefined),
  tone: (_ref, ctx) => (ctx.stylePrefs ? ctx.stylePrefs.tone : undefined),
});

export const WRITING_ASSIST_SOURCE_NAMES = exactKeys<WritingAssistantSources>()(
  "userText",
  "context",
  "stylePrefs",
  "globals",
  "styleGuide",
  "tone"
);
