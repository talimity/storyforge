import { type SqliteDatabase, schema } from "@storyforge/db";
import type { WorkflowRunner } from "@storyforge/gentasks";
import { assertNever, createId } from "@storyforge/utils";
import { and, asc, eq } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import type { TimelineService } from "../timeline/timeline.service.js";
import { makeExecutors } from "./executors.js";
import { intentRunManager } from "./run-manager.js";
import type { CreateIntentArgs } from "./types.js";

export class IntentService {
  constructor(
    private db: SqliteDatabase,
    private timeline: TimelineService,
    private runner: WorkflowRunner<"turn_generation">
  ) {}

  async createAndStart(args: CreateIntentArgs) {
    if (!intentRunManager) throw new Error("Run manager not initialized");

    const intentId = createId();

    // 1) record pending intent with params
    const [intent] = await this.db
      .insert(schema.intents)
      .values({
        id: intentId,
        status: "pending",
        kind: args.kind,
        scenarioId: args.scenarioId,
        targetParticipantId: "targetParticipantId" in args ? args.targetParticipantId : null,
        inputText: "text" in args ? args.text : null,
      })
      .returning();

    // 2) Determine branch origin, if any
    const branchFromTurnId = await this.computeBranchFromTurnId(args);

    // 3) choose appropriate intent executor
    const abortCtl = new AbortController();
    const executors = makeExecutors({
      db: this.db,
      timeline: this.timeline,
      runner: this.runner,
      now: () => Date.now(),
      intentId,
      branchFromTurnId,
      scenarioId: args.scenarioId,
      signal: abortCtl.signal,
    });
    const exec = (() => {
      switch (args.kind) {
        case "manual_control":
          return executors.manualControl({
            actorId: args.targetParticipantId,
            text: args.text,
          });
        case "guided_control":
          return executors.guidedControl({
            actorId: args.targetParticipantId,
            constraint: args.text,
          });
        case "narrative_constraint":
          return executors.narrativeConstraint({ text: args.text });
        case "continue_story":
          return executors.continueStory();
        default:
          assertNever(args);
      }
    })();

    // 4) start the runner
    intentRunManager.start(intentId, args.scenarioId, args.kind, exec, abortCtl);

    return intent;
  }

  /**
   * Determines the branching point for the given intent creation args. Returns the ID of the
   * turn to branch from. Returns undefined if the intent should not branch at all.
   */
  private async computeBranchFromTurnId(args: CreateIntentArgs) {
    if (!args.branchFrom) return undefined;

    const { kind, targetId } = args.branchFrom;
    if (kind === "turn_parent") {
      return this.resolveBranchFromTurnParent(args.scenarioId, targetId);
    }
    if (kind === "intent_start") {
      return this.resolveBranchFromIntentStart(args.scenarioId, targetId);
    }
    assertNever(kind);
  }

  private async resolveBranchFromTurnParent(scenarioId: string, turnId: string) {
    const turn = await this.db.query.turns.findFirst({
      where: { id: turnId, scenarioId },
      columns: { parentTurnId: true },
    });

    if (!turn) {
      throw new ServiceError("NotFound", {
        message: `Turn ${turnId} not found in scenario ${scenarioId}`,
      });
    }

    // "branching" a scenario with only one turn doesn't make much sense and
    // DB constraint will reject it anyway, so we'll just throw an error here.
    if (!turn.parentTurnId) {
      throw new ServiceError("InvalidInput", {
        message: `Cannot branch from start of scenario ${scenarioId}`,
      });
    }
    return turn.parentTurnId;
  }

  /**
   * Returns the parent turn ID of the first turn created by the given intent.
   */
  private async resolveBranchFromIntentStart(scenarioId: string, intentId: string) {
    const row = await this.db
      .select({ parentTurnId: schema.turns.parentTurnId })
      .from(schema.intentEffects)
      .innerJoin(schema.turns, eq(schema.turns.id, schema.intentEffects.turnId))
      .where(
        and(
          eq(schema.intentEffects.intentId, intentId),
          eq(schema.intentEffects.kind, "new_turn"),
          eq(schema.turns.scenarioId, scenarioId)
        )
      )
      .orderBy(asc(schema.intentEffects.sequence))
      .limit(1)
      .get();

    if (!row) {
      throw new ServiceError("InvalidInput", {
        message: `Intent ${intentId} has no turns to branch from in scenario ${scenarioId}`,
      });
    }

    // see comment in resolveBranchFromTurnParent
    if (!row.parentTurnId) {
      throw new ServiceError("InvalidInput", {
        message: `Cannot branch from start of scenario ${scenarioId}`,
      });
    }

    return row.parentTurnId;
  }
}
