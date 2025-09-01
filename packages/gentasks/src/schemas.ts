import { z } from "zod";

export const taskKindSchema = z.enum([
  "turn_generation",
  "chapter_summarization",
  "writing_assistant",
]);
