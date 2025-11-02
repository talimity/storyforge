import type { TaskKind } from "../types.js";
import { CHAPTER_SUMM_SOURCE_NAMES } from "./chapter-summarization.js";
import { TURN_GEN_SOURCE_NAMES } from "./turn-generation.js";
import { WRITING_ASSIST_SOURCE_NAMES } from "./writing-assistant.js";

export type TaskDescriptor = {
  id: TaskKind;
  providedSources: readonly string[];
};

export const TASK_DESCRIPTORS = {
  turn_generation: {
    id: "turn_generation",
    providedSources: TURN_GEN_SOURCE_NAMES,
  },
  chapter_summarization: {
    id: "chapter_summarization",
    providedSources: CHAPTER_SUMM_SOURCE_NAMES,
  },
  writing_assistant: {
    id: "writing_assistant",
    providedSources: WRITING_ASSIST_SOURCE_NAMES,
  },
} as const satisfies Record<TaskKind, TaskDescriptor>;

export function getTaskDescriptor(task: TaskKind): TaskDescriptor {
  return TASK_DESCRIPTORS[task];
}
