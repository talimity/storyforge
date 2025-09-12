// apps/frontend/src/features/scenario-player/stores/intent-run-store.ts

import type { IntentEvent } from "@storyforge/contracts";
import type { WorkflowEvent } from "@storyforge/gentasks";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type IntentRunStatus = "pending" | "running" | "finished" | "failed" | "cancelled";

export type ProvisionalTurn = {
  /** Provisional text (built from gen_token or draft steps) */
  text: string;
  /** Optional hint about who is “speaking” for UI decoration */
  actorParticipantId?: string | null;
  /** When an effect commits, we flip status and store the turnId */
  status: "streaming" | "committed" | "error";
  committedTurnId?: string;
};

export type StepState = {
  id: string;
  name?: string;
  status: "idle" | "running" | "finished" | "error";
  /** latest rendered prompt for debug, optional */
  lastPromptPreview?: { messages: unknown[] };
};

export interface IntentRun {
  id: string; // intentId
  scenarioId: string;
  kind?: string;

  status: IntentRunStatus;
  startedAt?: number;
  finishedAt?: number;

  // current draft (streaming) text, independent of “committed effects”
  livePreview: string;

  // often just one item; list allows future multi-effect previews
  provisional: ProvisionalTurn[];

  // committed effect IDs, in order (we still invalidate timeline to fetch actual content)
  committedTurnIds: string[];

  // workflow step state for to show progress
  steps: Record<string, StepState>;

  // convenience flags
  currentActorParticipantId?: string | null;
  error?: string;
}

interface IntentRunsState {
  runsById: Record<string, IntentRun>;
  currentRunId: string | null;

  /** start a new run placeholder */
  startRun: (args: { intentId: string; scenarioId: string; kind?: string }) => void;
  /** reduce a single event into state */
  applyEvent: (event: IntentEvent) => void;
  /** clears current intent run */
  clearActiveRun: () => void;
  /** clears all intent runs */
  clearAllRuns: () => void;
}

export const useIntentRunsStore = create<IntentRunsState>()(
  immer((set) => ({
    runsById: {},
    currentRunId: null,

    startRun: ({ intentId, scenarioId, kind }) =>
      set((s) => {
        s.runsById[intentId] = {
          id: intentId,
          scenarioId,
          kind,
          status: "pending",
          startedAt: Date.now(),
          livePreview: "",
          provisional: [],
          committedTurnIds: [],
          steps: {},
        };
        s.currentRunId = intentId;
      }),

    applyEvent: (ev) =>
      set((s) => {
        const run = s.runsById[ev.intentId];
        if (!run) {
          console.warn("Received event for unknown intent run, ignoring", ev.intentId);
          return;
        }

        switch (ev.type) {
          case "intent_started":
            run.status = "running";
            run.startedAt = ev.ts;
            run.kind = ev.kind ?? run.kind;
            return;

          case "actor_selected":
            run.currentActorParticipantId = ev.participantId;
            // Ensure we have at least one provisional turn to stream into
            if (run.provisional.length === 0) {
              run.provisional.push({
                text: "",
                actorParticipantId: ev.participantId,
                status: "streaming",
              });
            } else {
              // set actor for the active streaming provisional turn
              const p = run.provisional[run.provisional.length - 1];
              if (p.status === "streaming") p.actorParticipantId = ev.participantId;
            }
            return;

          case "gen_token": {
            // append to live preview and to the current streaming provisional
            run.livePreview += ev.delta;
            if (run.provisional.length === 0) {
              run.provisional.push({
                text: ev.delta,
                actorParticipantId: run.currentActorParticipantId ?? null,
                status: "streaming",
              });
            } else {
              const p = run.provisional[run.provisional.length - 1];
              if (p.status === "streaming") p.text += ev.delta;
            }
            return;
          }

          case "gen_event":
            reduceRunnerEvent(run, ev.payload);
            return;

          case "effect_committed":
            run.committedTurnIds.push(ev.turnId);
            // Mark the current streaming provisional (if any) as committed
            if (run.provisional.length > 0) {
              const p = run.provisional[run.provisional.length - 1];
              if (p.status === "streaming") {
                p.status = "committed";
                p.committedTurnId = ev.turnId;
              }
            }
            // reset live preview for the next effect (if any)
            run.livePreview = "";
            return;

          case "intent_finished":
            run.status = "finished";
            run.finishedAt = ev.ts;
            return;

          case "intent_failed":
            run.status = "failed";
            run.error = ev.error;
            if (ev.partialText) {
              // keep the partial in the last provisional
              if (run.provisional.length === 0) {
                run.provisional.push({
                  text: ev.partialText,
                  actorParticipantId: run.currentActorParticipantId ?? null,
                  status: "streaming",
                });
              } else {
                const p = run.provisional[run.provisional.length - 1];
                if (p.status === "streaming") p.text = ev.partialText;
              }
              run.livePreview = ev.partialText;
            }
            return;
        }
      }),

    clearActiveRun: () =>
      set((s) => {
        s.currentRunId = null;
      }),

    clearAllRuns: () =>
      set((s) => {
        s.currentRunId = null;
        s.runsById = {};
      }),
  }))
);

function reduceRunnerEvent(run: IntentRun, e: WorkflowEvent) {
  switch (e.type) {
    case "step_started":
      run.steps[e.stepId] = { id: e.stepId, name: e.name, status: "running" };
      break;
    case "prompt_rendered":
      run.steps[e.stepId] ??= { id: e.stepId, status: "running" };
      run.steps[e.stepId].lastPromptPreview = { messages: e.messages };
      break;
    case "step_captured":
    case "step_finished":
      run.steps[e.stepId] ??= { id: e.stepId, status: "running" };
      run.steps[e.stepId].status = "finished";
      break;
    case "run_error":
      if (e.stepId) {
        run.steps[e.stepId] ??= { id: e.stepId, status: "running" };
        run.steps[e.stepId].status = "error";
      }
      run.status = "failed";
      run.error = e.error;
      break;
    case "run_cancelled":
      run.status = "cancelled";
      break;
  }
}

// Selectors
export const selectCurrentRun = (s: IntentRunsState) => {
  const id = s.currentRunId;
  return id ? s.runsById[id] : undefined;
};

export const selectCurrentRunStatus = (s: IntentRunsState) => {
  const run = selectCurrentRun(s);
  return run?.status ?? "finished";
};
