import type { LorebookAssignment } from "@storyforge/lorebooks";
import type {
  ChapterContext,
  ChapterSummaryContext,
  CharacterContext,
  TurnContext,
} from "./dtos.js";

export type NarrativeGlobals = {
  scenario?: string;
};

export type NarrativeContext = {
  turns: TurnContext[];
  characters: CharacterContext[];
  lorebooks: LorebookAssignment[];
  chapterSummaries: ChapterSummaryContext[];
  chapters: ChapterContext[];
};
