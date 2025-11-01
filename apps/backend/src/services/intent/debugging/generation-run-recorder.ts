import type { IntentEvent } from "@storyforge/contracts";
import {
  type GenerationRunStep,
  generationRunSteps,
  generationRuns,
  type SqliteDatabase,
} from "@storyforge/db";
import type { WorkflowEvent } from "@storyforge/gentasks";
import { assertDefined } from "@storyforge/utils";
import { and, eq } from "drizzle-orm";

interface PendingContext {
  participantId: string;
  workflowId: string;
  branchFromTurnId?: string | null;
}

interface RunState {
  generationRunId: string;
  stepOrder: string[];
}

/**
 * Listens to intent events and records generation runs in the database for
 * diagnostics and debugging purposes.
 */
export class GenerationRunRecorder {
  private pending: PendingContext[] = [];
  private runs = new Map<string, RunState>();
  private completedRuns = new Map<
    string,
    { finishedAt: Date; finalOutputs: Record<string, unknown>; stepOrder: string[] }
  >();

  constructor(
    private deps: {
      db: SqliteDatabase;
      scenarioId: string;
      intentId: string;
    }
  ) {}

  async handle(event: IntentEvent) {
    switch (event.type) {
      case "gen_start":
        this.pending.push(event);
        return;
      case "gen_event":
        await this.handleWorkflowEvent(event.payload, event.ts);
        return;
      case "intent_failed":
        await this.handleIntentFailed(event);
        return;
      case "effect_committed":
        await this.handleEffectCommitted(event);
        return;
      default:
        return;
    }
  }

  private async handleWorkflowEvent(event: WorkflowEvent, ts: number) {
    switch (event.type) {
      case "run_started": {
        const context = this.pending.shift();
        if (!context) return;

        const startedAt = new Date(ts);
        const [run] = await this.deps.db
          .insert(generationRuns)
          .values({
            scenarioId: this.deps.scenarioId,
            intentId: this.deps.intentId,
            participantId: context.participantId,
            workflowId: context.workflowId,
            branchFromTurnId: context.branchFromTurnId,
            status: "running",
            startedAt,
          })
          .returning({ id: generationRuns.id });

        if (!run) return;
        this.runs.set(event.runId, { generationRunId: run.id, stepOrder: [] });
        return;
      }
      case "step_started": {
        const runState = this.runs.get(event.runId);
        if (!runState) return;
        const idx = runState.stepOrder.length;
        runState.stepOrder.push(event.stepId);

        await this.deps.db.insert(generationRunSteps).values({
          idx,
          runId: runState.generationRunId,
          stepId: event.stepId,
          name: event.name,
        });

        await this.deps.db
          .update(generationRuns)
          .set({ stepOrder: [...runState.stepOrder] })
          .where(eq(generationRuns.id, runState.generationRunId));
        return;
      }
      case "prompt_rendered": {
        await this.updateStep(event.runId, event.stepId, {
          promptTemplateId: event.promptTemplateId,
          promptsRendered: event.messages,
        });
        return;
      }
      case "input_transformed": {
        await this.updateStep(event.runId, event.stepId, {
          promptsTransformed: event.messages,
        });
        return;
      }
      case "step_prompt": {
        await this.updateStep(event.runId, event.stepId, {
          modelProfileId: event.modelProfileId,
          modelId: event.modelId,
          hints: event.hints,
        });
        return;
      }
      case "step_captured": {
        await this.updateStep(event.runId, event.stepId, {
          capturedOutputs: event.outputs,
        });
        return;
      }
      case "step_finished": {
        const { apiPayload, response } = this.extractResponse(event.result.response);
        const patch: Partial<GenerationRunStep> = {};
        if (response !== undefined) {
          patch.response = response as GenerationRunStep["response"];
        }
        if (apiPayload !== undefined) {
          patch.apiPayload = apiPayload as GenerationRunStep["apiPayload"];
        }
        if (event.result.captured && Object.keys(event.result.captured).length > 0) {
          patch.capturedOutputs = event.result.captured;
        }
        await this.updateStep(event.runId, event.stepId, patch);
        return;
      }
      case "run_finished": {
        // Defer DB writes until the effect is committed; just record completion
        // locally and link on the subsequent effect_committed event.
        const runState = this.runs.get(event.runId);
        if (!runState) return;
        const finishedAt = new Date(ts);
        const finalOutputs = structuredClone(event.output ?? {});
        this.completedRuns.set(runState.generationRunId, {
          finishedAt,
          finalOutputs,
          stepOrder: [...runState.stepOrder],
        });
        return;
      }
      case "run_error": {
        const runState = this.runs.get(event.runId);
        if (!runState) return;
        const finishedAt = new Date(ts);
        await this.deps.db
          .update(generationRuns)
          .set({
            status: "error",
            error: event.error,
            finishedAt,
            stepOrder: [...runState.stepOrder],
          })
          .where(eq(generationRuns.id, runState.generationRunId));
        this.runs.delete(event.runId);
        return;
      }
      case "run_cancelled": {
        const runState = this.runs.get(event.runId);
        if (!runState) return;
        const finishedAt = new Date(ts);
        await this.deps.db
          .update(generationRuns)
          .set({ status: "cancelled", finishedAt, stepOrder: [...runState.stepOrder] })
          .where(eq(generationRuns.id, runState.generationRunId));
        this.runs.delete(event.runId);
        return;
      }
      default:
        return;
    }
  }

  private async updateStep(
    workflowRunId: string,
    stepId: string,
    patch: Partial<GenerationRunStep>
  ) {
    const runState = this.runs.get(workflowRunId);
    if (!runState) return;

    await this.deps.db
      .update(generationRunSteps)
      .set(patch)
      .where(
        and(
          eq(generationRunSteps.runId, runState.generationRunId),
          eq(generationRunSteps.stepId, stepId)
        )
      );
  }

  private async handleEffectCommitted(event: Extract<IntentEvent, { type: "effect_committed" }>) {
    if (event.effect !== "new_turn") return;

    // Correlate strictly via workflowRunId (always present)
    const runState = this.runs.get(event.workflowRunId);
    if (!runState) return;
    const targetRunId = runState.generationRunId;

    const completion = this.completedRuns.get(targetRunId);
    const update: Record<string, unknown> = {
      turnId: event.turnId,
      effectSequence: event.sequence,
      status: "finished",
    };

    if (completion) {
      update.finishedAt = completion.finishedAt;
      update.finalOutputs = completion.finalOutputs;
      update.stepOrder = completion.stepOrder;
      update.error = null;
      this.completedRuns.delete(targetRunId);
    }

    assertDefined(targetRunId, "Missing generation run id to link effect");
    await this.deps.db.update(generationRuns).set(update).where(eq(generationRuns.id, targetRunId));

    // Cleanup correlation mapping
    this.runs.delete(event.workflowRunId);
  }

  private async handleIntentFailed(event: Extract<IntentEvent, { type: "intent_failed" }>) {
    const finishedAt = new Date(event.ts);
    const status = event.cancelled ? "cancelled" : "error";

    await this.deps.db
      .update(generationRuns)
      .set({
        status,
        finishedAt,
        error: event.cancelled ? null : event.error,
      })
      .where(
        and(eq(generationRuns.intentId, this.deps.intentId), eq(generationRuns.status, "running"))
      );

    this.pending = [];
    this.runs.clear();
    this.completedRuns.clear();
  }

  private extractResponse(response: unknown) {
    if (!response || typeof response !== "object") {
      return { response: undefined, apiPayload: undefined };
    }

    const typed = response as Record<string, unknown>;
    const metadataRaw = typed.metadata;
    if (!metadataRaw || typeof metadataRaw !== "object") {
      return { response: typed, apiPayload: undefined };
    }

    if (!("_prompt" in metadataRaw)) {
      return { response: typed, apiPayload: undefined };
    }

    const { _prompt, ...rest } = metadataRaw as Record<string, unknown>;
    const sanitisedMetadata = Object.keys(rest).length > 0 ? rest : undefined;
    const cleaned: Record<string, unknown> = { ...typed };
    if (sanitisedMetadata !== undefined) {
      cleaned.metadata = sanitisedMetadata;
    } else {
      delete cleaned.metadata;
    }

    return {
      response: cleaned,
      apiPayload: _prompt,
    };
  }
}
