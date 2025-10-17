import type { IntentEvent } from "@storyforge/contracts";
import type { WorkflowEvent } from "@storyforge/gentasks";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

const DRAFT_FLUSH_INTERVAL_MS = 100; // ~10 FPS
const draftFlushTimers = new Map<string, number>();

export type IntentRunStatus = "pending" | "running" | "finished" | "failed" | "cancelled";

export type ProvisionalTurn = {
  /** Provisional text (built from gen_token or draft steps) */
  text: string;
  /** Optional hint about who is "speaking" for UI decoration */
  actorParticipantId?: string | null;
  status: "streaming" | "error";
  committedTurnId?: string;
};

export type StepState = {
  id: string;
  name?: string;
  status: "idle" | "running" | "finished" | "error";
  /** latest rendered prompt for debug, optional */
  lastPromptPreview?: { messages: unknown[] };
  /** Number of streamed token deltas received for this step */
  deltaCount?: number;
  /** Approximate characters streamed for this step */
  charCount?: number;
};

export interface IntentRun {
  id: string; // intentId
  scenarioId: string;
  kind?: string;

  status: IntentRunStatus;
  startedAt?: number;
  finishedAt?: number;

  // current draft (streaming) text, independent of committed effects
  livePreview: string;
  // throttled, UI-facing preview copied from livePreview
  displayPreview: string;

  // often just one item; list allows future multi-effect previews
  provisional: ProvisionalTurn[];

  // committed effect IDs, in order (we still invalidate timeline to fetch actual content)
  committedTurnIds: string[];

  // workflow step state for to show progress
  steps: Record<string, StepState>;

  // convenience flags
  currentActorParticipantId?: string | null;
  error?: string;

  /** Whether the most recent token is presentation prose (default true when unknown). */
  lastTokenIsPresentation?: boolean;
  /** Throttled char count for progress display */
  displayCharCount: number;

  // client display hint
  /**
   * If set, the timeline should be visually truncated after this turn.
   * Used after branching the timeline, before an `effect_committed` event has
   * been received (at which point we can formally switch to the new branch and
   * no longer have to hide turns from the old branch).
   */
  truncateAfterTurnId?: string;
}

export interface IntentRunsState {
  runsById: Record<string, IntentRun>;
  currentRunId: string | null;
  lastScenarioId: string | null;

  /** start a new run placeholder */
  startRun: (args: { intentId: string; scenarioId: string; kind?: string }) => void;
  /** reduce a single event into state */
  applyEvent: (event: IntentEvent) => void;
  /** clears current intent run */
  clearActiveRun: () => void;
  /** clears all intent runs */
  clearAllRuns: (nextScenarioId: string) => void;
}

export const useIntentRunsStore = create<IntentRunsState>()(
  immer((set) => ({
    runsById: {},
    currentRunId: null,
    lastScenarioId: null,

    startRun: ({ intentId, scenarioId, kind }) =>
      set((s) => {
        console.log("Starting run", intentId, scenarioId, kind);
        s.runsById[intentId] = {
          id: intentId,
          scenarioId,
          kind,
          status: "pending",
          startedAt: Date.now(),
          livePreview: "",
          displayPreview: "",
          provisional: [],
          committedTurnIds: [],
          steps: {},
          truncateAfterTurnId: undefined,
          displayCharCount: 0,
        };
        s.currentRunId = intentId;
        s.lastScenarioId = scenarioId;
      }),

    applyEvent: (ev) => {
      set((s) => {
        const run = s.runsById[ev.intentId];
        if (!run) {
          console.warn("Received event for unknown intent run, ignoring", s.runsById, ev.intentId);
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

          case "gen_start": {
            if (ev.branchFromTurnId) {
              // We're starting generation for a branch, so we need to
              // temporarily hide turns after the branching point until this
              // turn finishes generating.
              run.truncateAfterTurnId = ev.branchFromTurnId;
            }
            if (ev.participantId) {
              run.currentActorParticipantId = ev.participantId;
            }
            return;
          }

          case "gen_token": {
            // append to live preview and to the current streaming provisional
            run.livePreview += ev.delta;
            run.lastTokenIsPresentation = ev.presentation ?? true;
            // Track per-step progress counts
            const step = (run.steps[ev.stepId] ??= { id: ev.stepId, status: "running" });
            step.deltaCount = (step.deltaCount ?? 0) + 1;
            step.charCount = (step.charCount ?? 0) + ev.delta.length;
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
            // schedule throttled UI flush for display fields
            if (!draftFlushTimers.has(ev.intentId)) {
              const tid = setTimeout(() => {
                // copy snapshot to UI-facing fields
                useIntentRunsStore.setState((state) => {
                  const r = state.runsById[ev.intentId];
                  if (!r) return state;
                  r.displayPreview = r.livePreview;
                  const running = Object.values(r.steps).find((st) => st.status === "running");
                  r.displayCharCount = running?.charCount ?? 0;
                  return state;
                });
                draftFlushTimers.delete(ev.intentId);
              }, DRAFT_FLUSH_INTERVAL_MS) as unknown as number;
              draftFlushTimers.set(ev.intentId, tid);
            }
            return;
          }

          case "gen_event":
            reduceRunnerEvent(run, ev.payload);
            return;

          case "effect_committed":
            run.committedTurnIds.push(ev.turnId);
            // this event triggers an invalidation of the timeline, so we can
            // show the real state from the server
            run.truncateAfterTurnId = undefined;
            run.displayPreview = "";
            run.displayCharCount = 0;
            return;

          case "intent_finished":
            run.status = "finished";
            run.finishedAt = ev.ts;
            run.truncateAfterTurnId = undefined;
            run.displayPreview = "";
            run.displayCharCount = 0;
            return;

          case "intent_failed": {
            run.status = ev.cancelled ? "cancelled" : "failed";
            run.error = ev.cancelled ? undefined : ev.error;
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
            run.truncateAfterTurnId = undefined;
            run.displayPreview = run.livePreview;
            const running = Object.values(run.steps).find((st) => st.status === "running");
            run.displayCharCount = running?.charCount ?? 0;
            return;
          }
        }
      });
    },

    clearActiveRun: () =>
      set((s) => {
        console.log("Clearing active run", s.currentRunId);
        s.currentRunId = null;
      }),

    clearAllRuns: (nextScenarioId) =>
      set((s) => {
        if (s.lastScenarioId === nextScenarioId) {
          console.log("Not clearing all runs, scenario hasn't changed");
          return;
        }
        if (s.currentRunId) {
          console.log("Clearing runs", s.lastScenarioId, s.currentRunId);
        }
        s.currentRunId = null;
        s.runsById = {};
      }),
  }))
);

function reduceRunnerEvent(run: IntentRun, e: WorkflowEvent) {
  switch (e.type) {
    case "step_started":
      run.steps[e.stepId] = {
        id: e.stepId,
        name: e.name,
        status: "running",
        deltaCount: 0,
        charCount: 0,
      };
      break;
    case "prompt_rendered":
      run.steps[e.stepId] ??= { id: e.stepId, status: "running" };
      run.steps[e.stepId].lastPromptPreview = { messages: e.messages };
      break;
    case "step_captured":
    case "step_finished":
      run.steps[e.stepId] ??= { id: e.stepId, status: "running" };
      run.steps[e.stepId].status = "finished";
      run.provisional[0].text = "";
      run.livePreview = "";
      run.lastTokenIsPresentation = undefined;
      run.displayPreview = "";
      run.displayCharCount = 0;
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

export const selectIsGenerating = (s: IntentRunsState) => {
  const r = selectCurrentRun(s);
  return r ? r.status === "pending" || r.status === "running" : false;
};
