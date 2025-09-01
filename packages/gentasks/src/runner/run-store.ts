import type { ChatCompletionResponse } from "@storyforge/inference";
import { nanoid } from "nanoid";
import type { TaskKind } from "../types";
import { AsyncQueue } from "./async-queue";
import type { RunId, RunnerEvent, RunSnapshot } from "./types";

interface RunData {
  /** Buffered event log */
  events: RunnerEvent[];
  /** Signal queue for new events */
  ticks: AsyncQueue<void>;
  /** Abort controller for cancellation */
  aborted: AbortController;
  meta: { workflowId: string; task: TaskKind };
  stepOutputs: Record<string, unknown>;
  stepResponses: Record<string, ChatCompletionResponse>;
  final?: Record<string, unknown>;
  error?: string;
  resultResolve?: (value: {
    finalOutputs: Record<string, unknown>;
    stepResponses: Record<string, ChatCompletionResponse>;
  }) => void;
  resultReject?: (error: Error) => void;
}

/**
 * In-memory store for managing workflow runs.
 * Handles event buffering, cancellation, and result promises.
 */
export class RunStore {
  private runs = new Map<RunId, RunData>();

  /**
   * Create a new run with a unique ID
   */
  create(
    workflowId: string,
    task: TaskKind
  ): {
    id: RunId;
    signal: AbortSignal;
    resultPromise: Promise<{
      finalOutputs: Record<string, unknown>;
      stepResponses: Record<string, ChatCompletionResponse>;
    }>;
  } {
    const id = nanoid();
    const aborted = new AbortController();

    let resultResolve:
      | ((value: {
          finalOutputs: Record<string, unknown>;
          stepResponses: Record<string, ChatCompletionResponse>;
        }) => void)
      | undefined;
    let resultReject: ((error: Error) => void) | undefined;
    const resultPromise = new Promise<{
      finalOutputs: Record<string, unknown>;
      stepResponses: Record<string, ChatCompletionResponse>;
    }>((resolve, reject) => {
      resultResolve = resolve;
      resultReject = reject;
    });

    const run: RunData = {
      events: [],
      ticks: new AsyncQueue<void>(),
      aborted,
      meta: { workflowId, task },
      stepOutputs: {},
      stepResponses: {},
      resultResolve,
      resultReject,
    };

    this.runs.set(id, run);
    return { id, signal: aborted.signal, resultPromise };
  }

  /**
   * Push a new event to a run's event log
   */
  push(id: RunId, event: RunnerEvent) {
    const run = this.runs.get(id);
    if (!run) throw new Error(`Run ${id} not found`);

    run.events.push(event);
    if (!run.ticks.isClosed()) {
      run.ticks.push();
    }
  }

  /**
   * Update step outputs for a run
   */
  updateStepOutputs(id: RunId, patch: Record<string, unknown>) {
    const run = this.runs.get(id);
    if (!run) return;

    Object.assign(run.stepOutputs, patch);
  }

  /**
   * Save a step's response
   */
  saveStepResponse(
    id: RunId,
    stepId: string,
    response: ChatCompletionResponse
  ) {
    const run = this.runs.get(id);
    if (!run) return;

    run.stepResponses[stepId] = response;
  }

  /**
   * Mark a run as successfully completed
   */
  finalize(id: RunId, final: Record<string, unknown>) {
    const run = this.runs.get(id);
    if (!run) return;

    run.final = final;
    run.resultResolve?.({
      finalOutputs: final,
      stepResponses: run.stepResponses,
    });
    run.ticks.close();
  }

  /**
   * Mark a run as failed
   */
  fail(id: RunId, message: string) {
    const run = this.runs.get(id);
    if (!run) return;

    run.error = message;
    run.resultReject?.(new Error(message));
    run.ticks.close();
  }

  /**
   * Cancel a run
   */
  cancel(id: RunId) {
    const run = this.runs.get(id);
    if (!run) return;

    run.aborted.abort();
    run.resultReject?.(new Error("Workflow cancelled"));
  }

  /**
   * Close a run's event queue (no more events will be accepted)
   */
  closeQueue(id: RunId) {
    const run = this.runs.get(id);
    if (!run) return;

    run.ticks.close();
  }

  /**
   * Get an async iterator over a run's events.
   * Replays buffered events first, then streams live events.
   */
  async *events(id: RunId): AsyncIterable<RunnerEvent> {
    const run = this.runs.get(id);
    if (!run) throw new Error(`Run ${id} not found`);

    let idx = 0;

    const drain = function* () {
      while (idx < run.events.length) {
        yield run.events[idx++];
      }
    };

    // First drain everything so far
    yield* drain();

    // Then wait for ticks and drain again
    for await (const _tick of run.ticks.iterate()) {
      yield* drain();
    }
  }

  /**
   * Get a snapshot of a run's current state
   */
  snapshot(id: RunId): RunSnapshot | undefined {
    const run = this.runs.get(id);
    if (!run) return undefined;

    return {
      runId: id,
      workflowId: run.meta.workflowId,
      task: run.meta.task,
      events: [...run.events],
      stepOutputs: { ...run.stepOutputs },
      stepResponses: { ...run.stepResponses },
      final: run.final ? { ...run.final } : undefined,
      cancelled: run.aborted.signal.aborted,
      error: run.error,
    };
  }

  /**
   * Get the abort signal for a run
   */
  getSignal(id: RunId): AbortSignal | undefined {
    return this.runs.get(id)?.aborted.signal;
  }

  /**
   * Check if a run exists
   */
  has(id: RunId): boolean {
    return this.runs.has(id);
  }

  /**
   * Delete a run from the store (cleanup)
   */
  delete(id: RunId): boolean {
    const run = this.runs.get(id);
    if (!run) return false;

    run.ticks.close();
    return this.runs.delete(id);
  }

  /**
   * Get all active run IDs
   */
  getActiveRunIds(): RunId[] {
    return Array.from(this.runs.keys());
  }
}
