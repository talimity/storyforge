import { z } from "zod";
import type { TaskSourcesMap } from "./types";

export const taskKindSchema = z.enum([
  "turn_generation",
  "chapter_summarization",
  "writing_assistant",
]);

export type TaskKind = z.infer<typeof taskKindSchema>;
export type SourcesFor<K extends TaskKind> = TaskSourcesMap[K];
