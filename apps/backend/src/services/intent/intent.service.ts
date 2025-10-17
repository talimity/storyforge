import { type SqliteDatabase, schema } from "@storyforge/db";
import type { GenStep, GenWorkflow, WorkflowRunner, WorkflowRunResume } from "@storyforge/gentasks";
import { assertNever, createId } from "@storyforge/utils";
import { and, asc, eq } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import type { TimelineService } from "../timeline/timeline.service.js";
import { makeExecutors } from "./executors.js";
import { intentRunManager } from "./run-manager.js";
import type { CreateIntentArgs, IntentReplayConfig } from "./types.js";

export class IntentService {
  constructor(
    private db: SqliteDatabase,
    private timeline: TimelineService,
    private runner: WorkflowRunner<"turn_generation">
  ) {}

  async createAndStart(args: CreateIntentArgs) {
    if (!intentRunManager) throw new Error("Run manager not initialized");

    const intentId = createId();

    // 0) load replay context if requested
    // do this first to avoid leaving a pending intent if replay setup fails
    const replayConfig = args.replayFrom
      ? await this.prepareReplayContext({
          scenarioId: args.scenarioId,
          replay: args.replayFrom,
        })
      : undefined;

    if (replayConfig) {
      const specifiedParticipant = args.targetParticipantId;
      if (specifiedParticipant !== replayConfig.actorParticipantId) {
        throw new ServiceError("InvalidInput", {
          message: "Replayed generation runs must use the same participant as the original run",
        });
      }
    }

    // 1) record pending intent with params
    const [intent] = await this.db
      .insert(schema.intents)
      .values({
        id: intentId,
        status: "pending",
        kind: args.kind,
        scenarioId: args.scenarioId,
        targetParticipantId: args.targetParticipantId,
        inputText: "text" in args ? args.text : null,
      })
      .returning();

    // 2) determine branch origin, if any
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
      replay: replayConfig,
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
          return executors.narrativeConstraint({
            text: args.text,
            followupActorId: args.targetParticipantId,
          });
        case "continue_story":
          return executors.continueStory({ actorId: args.targetParticipantId });
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

  private async prepareReplayContext(args: {
    scenarioId: string;
    replay: NonNullable<CreateIntentArgs["replayFrom"]>;
  }): Promise<IntentReplayConfig> {
    const run = await this.db.query.generationRuns.findFirst({
      where: { id: args.replay.generationRunId },
      with: { steps: true },
    });

    if (!run) {
      throw new ServiceError("NotFound", {
        message: `Generation run ${args.replay.generationRunId} not found`,
      });
    }

    if (run.scenarioId !== args.scenarioId) {
      throw new ServiceError("InvalidInput", {
        message: `Generation run ${run.id} does not belong to scenario ${args.scenarioId}`,
      });
    }

    if (run.status !== "finished") {
      throw new ServiceError("InvalidInput", {
        message: `Generation run ${run.id} is not finished and cannot be replayed`,
      });
    }

    if (args.replay.expectedWorkflowId && args.replay.expectedWorkflowId !== run.workflowId) {
      throw new ServiceError("InvalidInput", {
        message: `Expected workflow ${args.replay.expectedWorkflowId} but run used ${run.workflowId}`,
      });
    }

    const orderedSteps = [...run.steps].sort((a, b) => a.idx - b.idx);
    const resumeIdx = orderedSteps.findIndex(
      (step) => step.stepId === args.replay.resumeFromStepId
    );
    if (resumeIdx === -1) {
      throw new ServiceError("InvalidInput", {
        message: `Step ${args.replay.resumeFromStepId} not found in generation run ${run.id}`,
      });
    }

    const seededOutputs: Record<string, unknown> = {};
    for (const step of orderedSteps.slice(0, resumeIdx)) {
      if (step.capturedOutputs && Object.keys(step.capturedOutputs).length > 0) {
        Object.assign(seededOutputs, structuredCloneJson(step.capturedOutputs));
      }
    }

    if (args.replay.stepOutputOverrides) {
      Object.assign(seededOutputs, args.replay.stepOutputOverrides);
    }

    if (resumeIdx > 0 && Object.keys(seededOutputs).length === 0) {
      throw new ServiceError("InvalidInput", {
        message: `Cannot resume generation run ${run.id} at step ${args.replay.resumeFromStepId} because no prior step outputs are available`,
      });
    }

    const workflowRow = await this.db.query.workflows.findFirst({
      where: { id: run.workflowId },
    });

    if (!workflowRow) {
      throw new ServiceError("NotFound", {
        message: `Workflow ${run.workflowId} referenced by generation run ${run.id} not found`,
      });
    }

    if (workflowRow.task !== "turn_generation") {
      throw new ServiceError("InvalidInput", {
        message: `Workflow ${workflowRow.id} is task ${workflowRow.task}, expected turn_generation`,
      });
    }

    const workflow: GenWorkflow<"turn_generation"> = {
      id: workflowRow.id,
      name: workflowRow.name,
      description: workflowRow.description ?? undefined,
      task: "turn_generation",
      version: 1,
      steps: (workflowRow.steps as GenStep[]) ?? [],
    };

    const stepExists = workflow.steps.some((step) => step.id === args.replay.resumeFromStepId);
    if (!stepExists) {
      throw new ServiceError("InvalidInput", {
        message: `Workflow ${workflow.id} no longer contains step ${args.replay.resumeFromStepId}`,
      });
    }

    const resume: WorkflowRunResume = {
      fromStepId: args.replay.resumeFromStepId,
      seededOutputs,
    };

    return {
      actorParticipantId: run.participantId,
      workflow,
      resume,
    };
  }
}

function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
