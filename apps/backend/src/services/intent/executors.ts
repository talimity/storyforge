import type { SqliteDatabase } from "@storyforge/db";
import { assertDefined } from "@storyforge/utils";
import { makeCommands } from "./commands.js";
import type { IntentExecDeps, IntentGenerator } from "./types.js";

/**
 * Returns a set of functions that can be used to apply different kinds of
 * intents to a scenario.
 */
export function makeExecutors(deps: IntentExecDeps) {
  const { chooseActor, generateTurn, insertTurn } = makeCommands(deps);
  // NOTE: branchFromTurnId should only be passed to the first turn
  // generated/inserted by an intent. insertTurn automatically advances the
  // scenario anchor, so subsequent calls will continue down the new branch.
  const { branchFromTurnId } = deps;

  /**
   * manual_control: player writes directly as Actor A; system generates a reply
   * from another actor.
   */
  function manualControl(args: { actorId: string; text: string }): IntentGenerator {
    return (async function* () {
      const { actorId, text } = args;
      const { turnId } = yield* insertTurn({ actorId, text, branchFromTurnId });
      const nextActor = yield* chooseActor({ afterTurnId: turnId });
      // The player's manual input was used for the turn we just inserted, so
      // we now just ask the model to continue without any constraint.
      const gen = yield* generateTurn({ intentKind: "continue_story", actorId: nextActor });
      yield* insertTurn({ actorId: nextActor, text: gen.presentation });
    })();
  }

  /** guided_control: system generates for selected actor given a constraint */
  function guidedControl(args: { actorId: string; constraint: string }): IntentGenerator {
    return (async function* () {
      const { actorId, constraint } = args;
      const gen = yield* generateTurn({
        intentKind: "guided_control",
        constraint,
        actorId,
        branchFromTurnId,
      });
      yield* insertTurn({ actorId, text: gen.presentation, branchFromTurnId });
    })();
  }

  /**
   * narrative_constraint: narrator generates a diagetic justification for the
   * player's input, then choose a next actor to continue with, then generate
   * a turn for that actor.
   */
  function narrativeConstraint(args: { text: string }): IntentGenerator {
    return (async function* () {
      const { text } = args;

      const narrator = await getNarratorParticipantId(deps.db, deps.scenarioId);
      const narratorGen = yield* generateTurn({
        intentKind: "narrative_constraint",
        constraint: text,
        actorId: narrator,
        branchFromTurnId,
      });
      const narratorTurn = yield* insertTurn({
        actorId: narrator,
        text: narratorGen.presentation,
        branchFromTurnId,
      });
      const nextActor = yield* chooseActor({ afterTurnId: narratorTurn.turnId });
      // Next actor continues the story with no constraint.
      // TODO: maybe this works better if we pass the same constraint to both
      // the narrator and the chosen follow-up actor?
      const actorGen = yield* generateTurn({ intentKind: "continue_story", actorId: nextActor });
      yield* insertTurn({ actorId: nextActor, text: actorGen.presentation });
    })();
  }

  /**
   * continue_story: player provides no input, system picks a character to
   * continue the story and generates a turn without any constraint.
   */
  function continueStory(): IntentGenerator {
    return (async function* () {
      const nextActor = yield* chooseActor({ afterTurnId: branchFromTurnId });
      const gen = yield* generateTurn({
        intentKind: "continue_story",
        actorId: nextActor,
        branchFromTurnId,
      });
      yield* insertTurn({ actorId: nextActor, text: gen.presentation, branchFromTurnId });
    })();
  }

  return { manualControl, guidedControl, narrativeConstraint, continueStory };
}

async function getNarratorParticipantId(db: SqliteDatabase, scenarioId: string) {
  const narrator = await db.query.scenarioParticipants.findFirst({
    columns: { id: true },
    where: { scenarioId, type: "narrator" },
  });
  assertDefined(narrator, "Narrator participant missing");
  return narrator.id;
}
