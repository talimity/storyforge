import { defineRelations } from "drizzle-orm";
import * as schema from "./schema/index.js";

export const relations = defineRelations(schema, (r) => ({
  characters: {
    examples: r.many.characterExamples(),
    starters: r.many.characterStarters(),
    scenarios: r.many.scenarios({
      from: r.characters.id.through(r.scenarioParticipants.characterId),
      to: r.scenarios.id.through(r.scenarioParticipants.scenarioId),
    }),
  },
  characterExamples: {
    character: r.one.characters({
      from: r.characterExamples.characterId,
      to: r.characters.id,
    }),
  },
  characterStarters: {
    character: r.one.characters({
      from: r.characterStarters.characterId,
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
    authorParticipant: r.one.scenarioParticipants({
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
    layers: r.many.turnLayers(),
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
  turnLayers: {
    turn: r.one.turns({
      from: r.turnLayers.turnId,
      to: r.turns.id,
    }),
  },
  intents: {
    scenario: r.one.scenarios({
      from: r.intents.scenarioId,
      to: r.scenarios.id,
    }),
    effects: r.many.intentEffects(),
  },
  intentEffects: {
    intent: r.one.intents({
      from: r.intentEffects.intentId,
      to: r.intents.id,
    }),
    turn: r.one.turns({
      from: r.intentEffects.turnId,
      to: r.turns.id,
    }),
  },
}));
