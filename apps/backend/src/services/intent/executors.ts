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

  /**
   * manual_control: player writes directly as Actor A; system generates a reply
   * from another actor.
   */
  function manualControl(args: {
    actorId: string;
    text: string;
  }): IntentGenerator {
    return (async function* () {
      const { actorId, text } = args;

      const { turnId } = yield* insertTurn({ actorId, text });
      const nextActor = yield* chooseActor({ afterTurnId: turnId });
      const gen = yield* generateTurn({ actorId: nextActor });
      yield* insertTurn({ actorId: nextActor, text: gen.presentation });
    })();
  }

  /** guided_control: system generates for selected actor given a constraint */
  function guidedControl(args: {
    actorId: string;
    constraint: string;
  }): IntentGenerator {
    return (async function* () {
      const { actorId, constraint } = args;

      const gen = yield* generateTurn({ actorId, constraint });
      yield* insertTurn({ actorId, text: gen.presentation });
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
        actorId: narrator,
        constraint: text,
      });
      const narratorTurn = yield* insertTurn({
        actorId: narrator,
        text: narratorGen.presentation,
      });
      const nextActor = yield* chooseActor({
        afterTurnId: narratorTurn.turnId,
      });
      const actorGen = yield* generateTurn({ actorId: nextActor });
      yield* insertTurn({ actorId: nextActor, text: actorGen.presentation });
    })();
  }

  /**
   * continue_story: player provides no input, system picks a character to
   * continue the story and generates a turn without any constraint.
   */
  function continueStory(): IntentGenerator {
    return (async function* () {
      const nextActor = yield* chooseActor({});
      const gen = yield* generateTurn({ actorId: nextActor });
      yield* insertTurn({ actorId: nextActor, text: gen.presentation });
    })();
  }

  return { manualControl, guidedControl, narrativeConstraint, continueStory };
}

async function getNarratorParticipantId(
  db: SqliteDatabase,
  scenarioId: string
) {
  const narrator = await db.query.scenarioParticipants.findFirst({
    columns: { id: true },
    where: { scenarioId, type: "narrator" },
  });
  assertDefined(narrator, "Narrator participant missing");
  return narrator.id;
}
