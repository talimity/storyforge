import type { SqliteDatabase } from "@storyforge/db";
import { schema } from "@storyforge/db";
import type { WorkflowRunner } from "@storyforge/gentasks";
import type { TimelineService } from "../timeline/timeline.service.js";
import { getTurngenWorkflowForScope } from "../workflows/workflow.queries.js";
import { chooseNextActorRoundRobin } from "./actor-selection.js";
import type { IntentEvent } from "./events.js";
import { TurngenContextBuilder } from "./turngen-context-builder.js";

type EffectGenerator<T> = AsyncGenerator<IntentEvent, T, void>;

export function makeEffects(deps: {
  db: SqliteDatabase;
  timeline: TimelineService;
  runner: WorkflowRunner<"turn_generation">;
  now: () => number;
  intentId: string;
  scenarioId: string;
}) {
  const { db, timeline, runner, now, intentId, scenarioId } = deps;

  return {
    insertTurn: async function* (args: {
      actorId: string;
      text: string;
    }): EffectGenerator<{ turnId: string }> {
      const turn = await timeline.advanceTurn({
        scenarioId,
        authorParticipantId: args.actorId,
        layers: [{ key: "presentation", content: args.text }],
      });
      await db.insert(schema.intentEffects).values({
        intentId,
        kind: "insert_turn",
        turnId: turn.id,
      });
      const ev: IntentEvent = {
        type: "effect_committed",
        intentId,
        effect: "insert_turn",
        turnId: turn.id,
        ts: now(),
      };
      yield ev;
      return { turnId: turn.id };
    },

    chooseActor: async function* (args: {
      afterTurnId?: string;
    }): EffectGenerator<string> {
      let afterAuthor: string | undefined;
      if (args.afterTurnId) {
        const turn = await db.query.turns.findFirst({
          columns: { authorParticipantId: true },
          where: { id: args.afterTurnId },
        });
        afterAuthor = turn?.authorParticipantId ?? undefined;
      }
      const participantId = await chooseNextActorRoundRobin(
        db,
        scenarioId,
        afterAuthor
      );
      const ev: IntentEvent = {
        type: "actor_selected",
        intentId,
        participantId: participantId,
        ts: now(),
      };
      yield ev;
      return participantId;
    },

    generateTurn: async function* (args: {
      actorId: string;
      constraint?: string;
    }): EffectGenerator<{
      presentation: string;
      outputs: Record<string, unknown>;
    }> {
      const workflow = await getTurngenWorkflowForScope(db, {
        scenarioId,
        participantId: args.actorId,
      });

      const ctx = await new TurngenContextBuilder(db, scenarioId).buildContext({
        actorParticipantId: args.actorId,
        // TODO: Need to change how TurnGenCtx receives intent parameters.
        // Prompt template should not directly receive intent parameters,
        // instead it receives an instruction prompt that may be a narrative
        // constraint, a general 'i want to see this' prompt, or a hard-coded
        // instruction for one of the Quick Action intents like "Jump Ahead".
        intent: { kind: "narrative_constraint", constraint: args.constraint },
      });

      const handle = await runner.startRun(workflow, ctx);
      let partial = "";

      for await (const ev of handle.events()) {
        if (ev.type === "stream_delta") {
          partial += ev.delta;
          yield {
            type: "gen_token",
            intentId,
            stepId: ev.stepId,
            delta: ev.delta,
            ts: now(),
          };
        } else {
          yield { type: "gen_event", intentId, payload: ev, ts: now() };
        }
      }

      const { finalOutputs } = await handle.result;
      const text = String(finalOutputs.presentation ?? partial ?? "").trim();
      if (!text) throw new Error("Empty generation output");

      return { presentation: text, outputs: finalOutputs };
    },
  };
}
