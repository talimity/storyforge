import { type SqliteTxLike, schema } from "@storyforge/db";
import { eq, sql } from "drizzle-orm";
import { getTurngenWorkflowForScope } from "../workflows/workflow.queries.js";
import { chooseNextActorRoundRobin } from "./actor-selection.js";
import { IntentContextBuilder } from "./context-builder.js";
import type { IntentCommandGenerator, IntentExecDeps } from "./types.js";

/**
 * Returns a set of commands that can be used during intent execution to
 * generate turn content and apply effects to the scenario.
 */
export function makeCommands(deps: IntentExecDeps) {
  const { db, timeline, runner, now, intentId, scenarioId } = deps;

  return {
    insertTurn: async function* (args: {
      actorId: string;
      text: string;
    }): IntentCommandGenerator<{ turnId: string }> {
      const newTurn = await db.transaction(async (tx) => {
        const turn = await timeline.advanceTurn(
          {
            scenarioId,
            authorParticipantId: args.actorId,
            layers: [{ key: "presentation", content: args.text }],
          },
          tx
        );

        const sequence = await getNextEffectSequence(tx, intentId);

        await tx.insert(schema.intentEffects).values({
          intentId,
          sequence,
          kind: "new_turn",
          turnId: turn.id,
        });

        return turn;
      });

      yield {
        type: "effect_committed",
        intentId,
        effect: "new_turn",
        turnId: newTurn.id,
        ts: now(),
      };

      return { turnId: newTurn.id };
    },

    chooseActor: async function* (args: { afterTurnId?: string }): IntentCommandGenerator<string> {
      let afterAuthor: string | undefined;
      if (args.afterTurnId) {
        const turn = await db.query.turns.findFirst({
          columns: { authorParticipantId: true },
          where: { id: args.afterTurnId },
        });
        afterAuthor = turn?.authorParticipantId ?? undefined;
      }

      const participantId = await chooseNextActorRoundRobin(db, scenarioId, afterAuthor);

      yield {
        type: "actor_selected",
        intentId,
        participantId: participantId,
        ts: now(),
      };

      return participantId;
    },

    generateTurn: async function* (args: {
      actorId: string;
      constraint?: string;
    }): IntentCommandGenerator<{
      presentation: string;
      outputs: Record<string, unknown>;
    }> {
      const ctx = await new IntentContextBuilder(db, scenarioId).buildContext({
        actorParticipantId: args.actorId,
        // TODO: Need to change how TurnGenCtx receives intent parameters.
        // Prompt template should not have to switch on intent kind; intent
        // should be implementation detail, template should receive just a
        // string, possibly via user-configurable intent kind-to-message map.
        intent: { kind: "narrative_constraint", constraint: args.constraint },
      });
      const workflow = await getTurngenWorkflowForScope(db, {
        scenarioId,
        participantId: args.actorId,
      });

      const handle = await runner.startRun(workflow, ctx, {
        parentSignal: deps.signal,
      });
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

async function getNextEffectSequence(db: SqliteTxLike, intentId: string) {
  const [{ next }] = await db
    .select({
      next: sql<number>`COALESCE(MAX(${schema.intentEffects.sequence}) + 1, 0)`,
    })
    .from(schema.intentEffects)
    .where(eq(schema.intentEffects.intentId, intentId));
  return next;
}
