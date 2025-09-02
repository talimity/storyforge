import type { SqliteDatabase } from "@storyforge/db";
import type { WorkflowRunner } from "@storyforge/gentasks";
import { assertDefined } from "@storyforge/utils";
import type { TimelineService } from "../timeline/timeline.service.js";
import { makeEffects } from "./effects.js";
import type { IntentEvent } from "./events.js";

export type IntentSaga = AsyncGenerator<IntentEvent, void, void>;

export function makeSagas(deps: {
  db: SqliteDatabase;
  timeline: TimelineService;
  runner: WorkflowRunner<"turn_generation">;
  now: () => number;
  intentId: string;
  scenarioId: string;
}) {
  const { db, timeline, runner, now, intentId, scenarioId } = deps;
  const fx = makeEffects({ db, timeline, runner, now, intentId, scenarioId });

  /**
   * manual_control: player writes directly as Actor A; system generates a reply
   * from another actor.
   */
  function manualControl(args: { actorId: string; text: string }): IntentSaga {
    return (async function* () {
      const { actorId, text } = args;

      const { turnId } = yield* fx.insertTurn({ actorId, text });
      const nextActor = yield* fx.chooseActor({ afterTurnId: turnId });
      const gen = yield* fx.generateTurn({ actorId: nextActor });
      yield* fx.insertTurn({ actorId: nextActor, text: gen.presentation });
    })();
  }

  /** guided_control: system generates for selected actor given a constraint */
  function guidedControl(args: {
    actorId: string;
    constraint: string;
  }): IntentSaga {
    return (async function* () {
      const { actorId, constraint } = args;

      const gen = yield* fx.generateTurn({ actorId, constraint });
      yield* fx.insertTurn({ actorId, text: gen.presentation });
    })();
  }

  /**
   * narrative_constraint: narrator generates a diagetic justification for the
   * player's input, then choose a next actor to continue with, then generate
   * a turn for that actor.
   */
  function narrativeConstraint(args: { text: string }): IntentSaga {
    return (async function* () {
      const { text } = args;

      const narrator = await getNarratorParticipantId(db, deps.scenarioId);
      const narratorGen = yield* fx.generateTurn({
        actorId: narrator,
        constraint: text,
      });
      const narratorTurn = yield* fx.insertTurn({
        actorId: narrator,
        text: narratorGen.presentation,
      });
      const nextActor = yield* fx.chooseActor({
        afterTurnId: narratorTurn.turnId,
      });
      const actorGen = yield* fx.generateTurn({ actorId: nextActor });
      yield* fx.insertTurn({ actorId: nextActor, text: actorGen.presentation });
    })();
  }

  /**
   * continue_story: player provides no input, system picks a character to
   * continue the story and generates a turn without any constraint.
   */
  function continueStory(): IntentSaga {
    return (async function* () {
      const nextActor = yield* fx.chooseActor({});
      const gen = yield* fx.generateTurn({ actorId: nextActor });
      yield* fx.insertTurn({ actorId: nextActor, text: gen.presentation });
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
