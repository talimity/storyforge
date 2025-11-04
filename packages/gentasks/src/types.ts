import type { ProviderKind } from "@storyforge/inference";
import type { z } from "zod";
import type { taskKindSchema } from "./schemas.js";
import type { ChapterSummarizationContext } from "./tasks/chapter-summarization/context.js";
import type { ChapterSummarizationSources } from "./tasks/chapter-summarization/source.js";
import type { TurnGenContext } from "./tasks/turngen/context.js";
import type { TurnGenSources } from "./tasks/turngen/source.js";
import type {
  WritingAssistantCtx,
  WritingAssistantSources,
} from "./tasks/writing-assistant/writing-assistant.js";

export type RunnerModelContext = {
  /** Provider-facing model identifier */
  id: string;
  /** Human-friendly display name for the configured profile */
  displayName: string;
  /** Optional per-model guidance text */
  modelInstruction?: string | null;
  /** Friendly name for the backing provider */
  providerName: string;
  providerKind: ProviderKind;
};

export type RuntimeSourceSpec = {
  stepOutput: { args: { key: string }; out: unknown };
};

export type TaskKind = z.infer<typeof taskKindSchema>;
export type TaskSourcesMap = {
  turn_generation: TurnGenSources;
  chapter_summarization: ChapterSummarizationSources;
  writing_assistant: WritingAssistantSources;
};

export type TaskContextMap = {
  turn_generation: TurnGenContext;
  chapter_summarization: ChapterSummarizationContext;
  writing_assistant: WritingAssistantCtx;
};
type AugmentedSources<K extends TaskKind> = TaskSourcesMap[K] & RuntimeSourceSpec;

export type SourcesFor<K extends TaskKind> = AugmentedSources<K>;
export type ContextFor<K extends TaskKind> = TaskContextMap[K];
