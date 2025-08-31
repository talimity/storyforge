export { SourcesFor, TaskKind, taskKindSchema } from "./schemas";
export {
  CHAPTER_SUMM_SOURCE_NAMES,
  type ChapterSummCtx,
  type ChapterSummRegistry,
  type ChapterSummSources,
  type ChapterSummTemplate,
  chapterSummarizationRegistry,
} from "./tasks/chapter-summarization";
export {
  TURN_GEN_SOURCE_NAMES,
  type TurnGenCtx,
  type TurnGenRegistry,
  type TurnGenSources,
  type TurnGenTemplate,
  turnGenRegistry,
} from "./tasks/turn-generation";
export {
  WRITING_ASSIST_SOURCE_NAMES,
  type WritingAssistantCtx,
  type WritingAssistantRegistry,
  type WritingAssistantSources,
  type WritingAssistantTemplate,
  writingAssistRegistry,
} from "./tasks/writing-assistant";
export type { TaskSourcesMap } from "./types";
