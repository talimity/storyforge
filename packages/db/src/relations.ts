import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  characterExamples: {
    character: r.one.characters({
      from: r.characterExamples.characterId,
      to: r.characters.id,
    }),
  },
  characters: {
    characterExamples: r.many.characterExamples(),
    characterGreetings: r.many.characterGreetings(),
    scenarios: r.many.scenarios({
      from: r.characters.id.through(r.scenarioParticipants.characterId),
      to: r.scenarios.id.through(r.scenarioParticipants.scenarioId),
    }),
  },
  characterGreetings: {
    character: r.one.characters({
      from: r.characterGreetings.characterId,
      to: r.characters.id,
    }),
  },
  scenarios: {
    characters: r.many.characters(),
    chapters: r.many.chapters(),
    turns: r.many.turns(),
    participants: r.many.scenarioParticipants(),
  },
  chapters: {
    scenario: r.one.scenarios({
      from: r.chapters.scenarioId,
      to: r.scenarios.id,
    }),
    turns: r.many.turns(),
  },
  turns: {
    scenarioParticipant: r.one.scenarioParticipants({
      from: r.turns.authorParticipantId,
      to: r.scenarioParticipants.id,
    }),
    chapter: r.one.chapters({
      from: r.turns.chapterId,
      to: r.chapters.id,
    }),
    scenario: r.one.scenarios({
      from: r.turns.scenarioId,
      to: r.scenarios.id,
    }),
  },
  scenarioParticipants: {
    turns: r.many.turns(),
    scenario: r.one.scenarios({
      from: r.scenarioParticipants.scenarioId,
      to: r.scenarios.id,
    }),
    character: r.one.characters({
      from: r.scenarioParticipants.characterId,
      to: r.characters.id,
    }),
  },
}));
