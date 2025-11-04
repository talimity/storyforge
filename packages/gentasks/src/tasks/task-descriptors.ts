import type { TaskKind } from "../types.js";
import { CHAPTER_SUMMARIZATION_SOURCE_NAMES } from "./chapter-summarization/source.js";
import { TURN_GEN_SOURCE_NAMES } from "./turngen/source.js";
import { WRITING_ASSIST_SOURCE_NAMES } from "./writing-assistant/writing-assistant.js";

type TaskDescriptor = {
  id: TaskKind;
  providedSources: readonly string[];
};

const TASK_DESCRIPTORS = {
  turn_generation: {
    id: "turn_generation",
    providedSources: TURN_GEN_SOURCE_NAMES,
  },
  chapter_summarization: {
    id: "chapter_summarization",
    providedSources: CHAPTER_SUMMARIZATION_SOURCE_NAMES,
  },
  writing_assistant: {
    id: "writing_assistant",
    providedSources: WRITING_ASSIST_SOURCE_NAMES,
  },
} as const satisfies Record<TaskKind, TaskDescriptor>;

export function getTaskDescriptor(task: TaskKind): TaskDescriptor {
  return TASK_DESCRIPTORS[task];
}
